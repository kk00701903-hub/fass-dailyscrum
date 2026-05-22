import type { JiraTask, Priority, Sprint, TaskStatus, TeamMember } from "@/lib/index";
import { TEAM_MEMBERS } from "@/lib/index";
import { jiraFetch, isJiraApiReachable } from "@/lib/jira-client";
import {
  getJiraBoardIdFromEnv,
  getJiraProjectKeyFromEnv,
  getJiraStoryPointsFieldIdFromEnv,
} from "@/lib/jira-env";

const JIRA_UNASSIGNED: TeamMember = {
  id: "jira-unassigned",
  name: "미배정",
  avatar: "?",
  role: "—",
  color: "#64748b",
};

interface JiraIssueRaw {
  id: string;
  key: string;
  fields: {
    summary?: string;
    updated?: string;
    labels?: string[];
    status?: { name?: string; statusCategory?: { key?: string } };
    priority?: { name?: string };
    assignee?: { displayName?: string; emailAddress?: string; accountId?: string } | null;
    [key: string]: unknown;
  };
}

function mapJiraStatus(status?: { name?: string; statusCategory?: { key?: string } }): TaskStatus {
  const cat = status?.statusCategory?.key;
  if (cat === "new") return "TODO";
  if (cat === "done") return "DONE";
  if (cat === "indeterminate") {
    const n = (status?.name ?? "").toLowerCase();
    if (n.includes("review") || n.includes("검토")) return "IN_REVIEW";
    if (n.includes("block")) return "BLOCKED";
    return "IN_PROGRESS";
  }
  return "TODO";
}

function mapJiraPriority(name?: string): Priority {
  const n = (name ?? "").toLowerCase();
  if (n.includes("highest")) return "HIGHEST";
  if (n.includes("high")) return "HIGH";
  if (n.includes("lowest")) return "LOWEST";
  if (n.includes("low")) return "LOW";
  if (n.includes("medium")) return "MEDIUM";
  return "MEDIUM";
}

function mapJiraAssignee(
  a: { displayName?: string; emailAddress?: string; accountId?: string } | null | undefined
): TeamMember {
  if (!a) return JIRA_UNASSIGNED;
  const byName = TEAM_MEMBERS.find((m) => m.name === a.displayName);
  if (byName) return byName;
  const name = a.displayName || a.emailAddress?.split("@")[0] || "Unknown";
  return {
    id: (a.accountId ?? `anon-${name}`).slice(0, 64),
    name,
    avatar: (name[0] ?? "?").toUpperCase(),
    role: "JIRA",
    color: "#94a3b8",
  };
}

function readStoryPoints(fields: JiraIssueRaw["fields"], storyField: string): number {
  const v = fields[storyField];
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mapIssue(issue: JiraIssueRaw, sprintId: string, storyField: string): JiraTask {
  const sp = readStoryPoints(issue.fields, storyField);
  const updated = issue.fields?.updated ?? new Date().toISOString();
  return {
    id: issue.id,
    key: issue.key,
    summary: issue.fields?.summary ?? "—",
    status: mapJiraStatus(issue.fields?.status),
    priority: mapJiraPriority(issue.fields?.priority?.name),
    assignee: mapJiraAssignee(issue.fields?.assignee),
    storyPoints: sp,
    updatedAt: updated,
    labels: issue.fields?.labels ?? [],
    sprintId,
  };
}

function assertSafeProjectKey(key: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`유효하지 않은 JIRA 프로젝트 키: ${key}`);
  return key;
}

function syntheticSprint(projectKey: string, issueCount: number): Sprint {
  return {
    id: "jira-live-search",
    name: projectKey ? `프로젝트 ${projectKey}` : "JQL 검색",
    state: "active",
    startDate: "—",
    endDate: "—",
    goal: `REST 검색 · ${issueCount}건${projectKey ? "" : " (VITE_JIRA_PROJECT_KEY 미설정 시 전체 최근 이슈)"}`,
  };
}

export async function pullJiraSyncData(): Promise<{
  usedLive: boolean;
  tasks: JiraTask[];
  sprint: Sprint | null;
  error: string | null;
}> {
  if (!isJiraApiReachable()) {
    return { usedLive: false, tasks: [], sprint: null, error: null };
  }

  const storyField = getJiraStoryPointsFieldIdFromEnv();

  try {
    const boardId = getJiraBoardIdFromEnv();
    if (boardId) {
      if (!/^\d+$/.test(boardId)) throw new Error("VITE_JIRA_BOARD_ID 는 숫자 보드 ID 여야 합니다.");
      const sprintRes = await jiraFetch<{
        values: Array<{
          id: number;
          name: string;
          state: string;
          goal?: string;
          startDate?: string;
          endDate?: string;
        }>;
      }>(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?state=active`);

      const active = sprintRes.values?.[0];
      if (active) {
        const sprint: Sprint = {
          id: `jira-sprint-${active.id}`,
          name: active.name,
          state: active.state === "active" ? "active" : active.state === "closed" ? "closed" : "future",
          startDate: active.startDate?.slice(0, 10) ?? "—",
          endDate: active.endDate?.slice(0, 10) ?? "—",
          goal: active.goal ?? "",
        };
        const fields = ["summary", "status", "priority", "assignee", "updated", "labels", storyField].join(",");
        const issuesRes = await jiraFetch<{ issues: JiraIssueRaw[] }>(
          `/rest/agile/1.0/sprint/${encodeURIComponent(String(active.id))}/issue?maxResults=100&fields=${encodeURIComponent(fields)}`
        );
        const tasks = (issuesRes.issues ?? []).map((issue) => mapIssue(issue, sprint.id, storyField));
        return { usedLive: true, tasks, sprint, error: null };
      }
    }

    const projectKey = getJiraProjectKeyFromEnv();
    const jql = projectKey
      ? `project = ${assertSafeProjectKey(projectKey)} ORDER BY updated DESC`
      : "updated >= -30d ORDER BY updated DESC";

    const searchRes = await jiraFetch<{ issues: JiraIssueRaw[] }>("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({
        jql,
        maxResults: 50,
        fields: ["summary", "status", "priority", "assignee", "updated", "labels", storyField],
      }),
    });

    const sprintId = projectKey ? `jira-proj-${projectKey}` : "jira-live-search";
    const tasks = (searchRes.issues ?? []).map((issue) => mapIssue(issue, sprintId, storyField));
    const sprint = syntheticSprint(projectKey, tasks.length);
    return { usedLive: true, tasks, sprint, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { usedLive: true, tasks: [], sprint: null, error: msg };
  }
}
