import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SprintState = "active" | "closed" | "future";
type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
type Priority = "HIGHEST" | "HIGH" | "MEDIUM" | "LOW" | "LOWEST";

const TEAM_BY_NAME: Record<string, { id: string; name: string; role: string; color: string }> = {
  서선범: { id: "seo", name: "서선범", role: "TFT 팀장", color: "#f59e0b" },
  기충영: { id: "ki", name: "기충영", role: "PL", color: "#22d3ee" },
  김희찬: { id: "kim", name: "김희찬", role: "Backend", color: "#60a5fa" },
  송민준: { id: "song", name: "송민준", role: "Backend", color: "#a78bfa" },
  심지훈: { id: "shim", name: "심지훈", role: "Frontend", color: "#34d399" },
  오준열: { id: "oh", name: "오준열", role: "Frontend", color: "#fb923c" },
  이지상: { id: "lee", name: "이지상", role: "Frontend", color: "#f87171" },
};

interface JiraIssueRaw {
  id: string;
  key: string;
  fields: {
    summary?: string;
    updated?: string;
    created?: string;
    resolutiondate?: string;
    duedate?: string;
    labels?: string[];
    status?: { name?: string; statusCategory?: { key?: string } };
    priority?: { name?: string };
    assignee?: { displayName?: string; emailAddress?: string; accountId?: string } | null;
    issuetype?: { name?: string; subtask?: boolean };
    parent?: { id?: string; key?: string };
    [key: string]: unknown;
  };
}

function toDateOnly(v?: string): string | null {
  if (!v?.trim()) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

function toTimestamptz(v?: string): string | null {
  if (!v?.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapIssueFields(
  issue: JiraIssueRaw,
  sprintId: string,
  storyField: string,
  now: string,
  assignee: ReturnType<typeof mapAssignee>
) {
  const issueType = issue.fields?.issuetype;
  const parent = issue.fields?.parent;
  return {
    id: issue.id,
    issue_key: issue.key,
    sprint_id: sprintId,
    summary: issue.fields?.summary ?? "—",
    status: mapJiraStatus(issue.fields?.status),
    priority: mapJiraPriority(issue.fields?.priority?.name),
    assignee_id: assignee.id,
    assignee_name: assignee.name,
    assignee_role: assignee.role,
    assignee_color: assignee.color,
    story_points: readStoryPoints(issue.fields, storyField),
    updated_at: issue.fields?.updated ?? now,
    labels: issue.fields?.labels ?? [],
    synced_at: now,
    assignee_account_id: issue.fields?.assignee?.accountId ?? null,
    assignee_email: issue.fields?.assignee?.emailAddress ?? null,
    due_date: toDateOnly(issue.fields?.duedate),
    start_date: null,
    created_at: toTimestamptz(issue.fields?.created),
    resolved_at: toTimestamptz(issue.fields?.resolutiondate),
    issue_type: issueType?.name ?? "",
    parent_issue_key: parent?.key ?? null,
    parent_id: null,
    is_subtask: Boolean(issueType?.subtask),
    jira_status_name: issue.fields?.status?.name ?? "",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  return "MEDIUM";
}

function mapAssignee(a: JiraIssueRaw["fields"]["assignee"]) {
  if (!a) {
    return { id: "jira-unassigned", name: "미배정", role: "—", color: "#64748b" };
  }
  const hit = a.displayName ? TEAM_BY_NAME[a.displayName] : undefined;
  if (hit) return hit;
  const name = a.displayName || a.emailAddress?.split("@")[0] || "Unknown";
  return {
    id: (a.accountId ?? `anon-${name}`).slice(0, 64),
    name,
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

async function jiraFetch<T>(baseUrl: string, auth: string, path: string, init: RequestInit = {}): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Atlassian-Token": "no-check",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    const msg =
      (Array.isArray(b?.errorMessages) ? b!.errorMessages.join(" · ") : null) ||
      (b?.message ? String(b.message) : null) ||
      text.slice(0, 200) ||
      res.statusText;
    throw new Error(`JIRA HTTP ${res.status}: ${msg}`);
  }
  return body as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const jiraBase = Deno.env.get("JIRA_BASE_URL")?.trim();
  const jiraEmail = Deno.env.get("JIRA_EMAIL")?.trim();
  const jiraToken = Deno.env.get("JIRA_API_TOKEN")?.trim();
  const boardId = Deno.env.get("JIRA_BOARD_ID")?.trim();
  const projectKey = Deno.env.get("JIRA_PROJECT_KEY")?.trim();
  const storyField = Deno.env.get("JIRA_STORY_POINTS_FIELD")?.trim() || "customfield_10016";

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 Edge Function 에 설정되지 않았습니다." }, 500);
  }
  if (!jiraBase || !jiraEmail || !jiraToken) {
    return json({ error: "JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN 시크릿을 설정하세요." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const auth = btoa(`${jiraEmail}:${jiraToken}`);
  const now = new Date().toISOString();

  const { data: runRow, error: runErr } = await supabase
    .from("jira_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (runErr || !runRow) {
    return json({ error: runErr?.message ?? "sync run insert failed" }, 500);
  }

  const runId = runRow.id as string;
  let sprintsCount = 0;
  let tasksCount = 0;

  try {
    const sprintRows: Array<{
      id: string;
      jira_sprint_id: string;
      name: string;
      state: SprintState;
      start_date: string;
      end_date: string;
      goal: string;
      board_id: string | null;
      synced_at: string;
    }> = [];

    const taskRows: Array<ReturnType<typeof mapIssueFields>> = [];

    if (boardId && /^\d+$/.test(boardId)) {
      const sprintRes = await jiraFetch<{
        values: Array<{
          id: number;
          name: string;
          state: string;
          goal?: string;
          startDate?: string;
          endDate?: string;
        }>;
      }>(
        jiraBase,
        auth,
        `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&maxResults=50`
      );

      const sprints = sprintRes.values ?? [];
      const closed = sprints.filter((s) => s.state === "closed").slice(-3);
      const toSync = [
        ...sprints.filter((s) => s.state === "active" || s.state === "future"),
        ...closed,
      ];

      for (const sp of toSync) {
        const state: SprintState =
          sp.state === "active" ? "active" : sp.state === "closed" ? "closed" : "future";
        const sprintId = `jira-sprint-${sp.id}`;
        sprintRows.push({
          id: sprintId,
          jira_sprint_id: String(sp.id),
          name: sp.name,
          state,
          start_date: sp.startDate?.slice(0, 10) ?? "—",
          end_date: sp.endDate?.slice(0, 10) ?? "—",
          goal: sp.goal ?? "",
          board_id: boardId,
          synced_at: now,
        });

        const fields = [
          "summary",
          "status",
          "priority",
          "assignee",
          "updated",
          "labels",
          "duedate",
          "created",
          "resolutiondate",
          "issuetype",
          "parent",
          storyField,
        ].join(",");
        const issuesRes = await jiraFetch<{ issues: JiraIssueRaw[] }>(
          jiraBase,
          auth,
          `/rest/agile/1.0/sprint/${sp.id}/issue?maxResults=200&fields=${encodeURIComponent(fields)}`
        );

        for (const issue of issuesRes.issues ?? []) {
          const assignee = mapAssignee(issue.fields?.assignee);
          taskRows.push(mapIssueFields(issue, sprintId, storyField, now, assignee));
        }
      }
    } else if (projectKey && /^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey)) {
      const sprintId = `jira-proj-${projectKey}`;
      sprintRows.push({
        id: sprintId,
        jira_sprint_id: `proj-${projectKey}`,
        name: `프로젝트 ${projectKey}`,
        state: "active",
        start_date: "—",
        end_date: "—",
        goal: `JQL 프로젝트 ${projectKey}`,
        board_id: null,
        synced_at: now,
      });

      const searchRes = await jiraFetch<{ issues: JiraIssueRaw[] }>(jiraBase, auth, "/rest/api/3/search/jql", {
        method: "POST",
        body: JSON.stringify({
          jql: `project = ${projectKey} ORDER BY updated DESC`,
          maxResults: 100,
          fields: [
            "summary",
            "status",
            "priority",
            "assignee",
            "updated",
            "labels",
            "duedate",
            "created",
            "resolutiondate",
            "issuetype",
            "parent",
            storyField,
          ],
        }),
      });

      for (const issue of searchRes.issues ?? []) {
        const assignee = mapAssignee(issue.fields?.assignee);
        taskRows.push(mapIssueFields(issue, sprintId, storyField, now, assignee));
      }
    } else {
      throw new Error("JIRA_BOARD_ID 또는 JIRA_PROJECT_KEY 시크릿 중 하나를 설정하세요.");
    }

    if (sprintRows.length > 0) {
      const { error } = await supabase.from("jira_sprints").upsert(sprintRows, { onConflict: "id" });
      if (error) throw error;
      sprintsCount = sprintRows.length;
    }

    if (taskRows.length > 0) {
      const { error: delErr } = await supabase.from("jira_tasks").delete().not("issue_key", "is", null);
      if (delErr) throw delErr;
      const { error } = await supabase.from("jira_tasks").insert(taskRows);
      if (error) throw error;
      tasksCount = taskRows.length;
    }

    await supabase
      .from("jira_sync_runs")
      .update({
        status: "success",
        finished_at: now,
        sprints_count: sprintsCount,
        tasks_count: tasksCount,
      })
      .eq("id", runId);

    return json({
      ok: true,
      sprintsCount,
      tasksCount,
      syncedAt: now,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("jira_sync_runs")
      .update({
        status: "error",
        finished_at: now,
        error_message: msg,
        sprints_count: sprintsCount,
        tasks_count: tasksCount,
      })
      .eq("id", runId);
    return json({ error: msg, sprintsCount, tasksCount }, 500);
  }
});
