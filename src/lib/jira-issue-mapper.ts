import type { Priority, TaskStatus, TeamMember } from "@/lib/index";
import { TEAM_MEMBERS } from "@/lib/index";

export const JIRA_ISSUE_FIELDS = [
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
  "issuelinks",
] as const;

export interface JiraIssueRaw {
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
    issuelinks?: Array<{
      id?: string;
      type?: { name?: string; inward?: string; outward?: string };
      outwardIssue?: { key?: string };
      inwardIssue?: { key?: string };
    }>;
    [key: string]: unknown;
  };
}

export interface JiraTaskDbRow {
  /** JIRA REST issue.id — DB PK·jira_issue_id 와 동일 */
  id: string;
  /** upsert onConflict 대상 (항상 issue.id 와 동일) */
  jira_issue_id?: string;
  issue_key: string;
  sprint_id: string;
  summary: string;
  status: TaskStatus;
  priority: Priority;
  assignee_id: string;
  assignee_name: string;
  assignee_role: string;
  assignee_color: string;
  story_points: number;
  updated_at: string;
  labels: string[];
  synced_at: string;
  assignee_account_id: string | null;
  assignee_email: string | null;
  due_date: string | null;
  start_date: string | null;
  created_at: string | null;
  resolved_at: string | null;
  issue_type: string;
  parent_issue_key: string | null;
  parent_id: string | null;
  is_subtask: boolean;
  jira_status_name: string;
}

const JIRA_UNASSIGNED = {
  id: "jira-unassigned",
  name: "미배정",
  role: "—",
  color: "#64748b",
};

export function mapJiraStatus(status?: { name?: string; statusCategory?: { key?: string } }): TaskStatus {
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

export function mapJiraPriority(name?: string): Priority {
  const n = (name ?? "").toLowerCase();
  if (n.includes("highest")) return "HIGHEST";
  if (n.includes("high")) return "HIGH";
  if (n.includes("lowest")) return "LOWEST";
  if (n.includes("low")) return "LOW";
  return "MEDIUM";
}

export function mapJiraAssignee(
  a: { displayName?: string; emailAddress?: string; accountId?: string } | null | undefined
): TeamMember & { accountId: string | null; email: string | null } {
  if (!a) {
    return {
      ...JIRA_UNASSIGNED,
      avatar: "?",
      accountId: null,
      email: null,
    };
  }
  const displayName = (a.displayName ?? "").trim();
  const byName = TEAM_MEMBERS.find((m) => {
    if (m.name === displayName) return true;
    if (displayName.length >= 2 && m.name.includes(displayName)) return true;
    if (displayName.length === 1 && m.name.endsWith(displayName)) return true;
    return false;
  });
  if (byName) {
    return {
      ...byName,
      accountId: a.accountId ?? null,
      email: a.emailAddress ?? null,
    };
  }
  const name = a.displayName || a.emailAddress?.split("@")[0] || "Unknown";
  return {
    id: (a.accountId ?? `anon-${name}`).slice(0, 64),
    name,
    avatar: (name[0] ?? "?").toUpperCase(),
    role: "JIRA",
    color: "#94a3b8",
    accountId: a.accountId ?? null,
    email: a.emailAddress ?? null,
  };
}

export function readStoryPoints(fields: JiraIssueRaw["fields"], storyField: string): number {
  const v = fields[storyField];
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toDateOnly(isoOrDate?: string): string | null {
  if (!isoOrDate?.trim()) return null;
  const s = isoOrDate.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toTimestamptz(iso?: string): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function extractCustomFieldDate(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return toDateOnly(value);
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.value === "string") return toDateOnly(o.value);
    if (typeof o.start === "string") return toDateOnly(o.start);
  }
  return null;
}

/** JIRA 시작일 커스텀 필드 (env 미설정 시 customfield_10015) */
export function readJiraStartDate(
  fields: JiraIssueRaw["fields"],
  startFieldId: string
): string | null {
  const primary = startFieldId.trim() || "customfield_10015";
  const fromPrimary = extractCustomFieldDate(fields[primary]);
  if (fromPrimary) return fromPrimary;

  return null;
}

export function mapIssueToDbRow(
  issue: JiraIssueRaw,
  sprintId: string,
  storyField: string,
  syncedAt: string,
  startFieldId = ""
): JiraTaskDbRow {
  const assignee = mapJiraAssignee(issue.fields?.assignee);
  const issueType = issue.fields?.issuetype;
  const parent = issue.fields?.parent;
  const isSubtask = Boolean(issueType?.subtask);

  return {
    id: issue.id,
    jira_issue_id: issue.id,
    issue_key: issue.key,
    sprint_id: sprintId,
    summary: (issue.fields?.summary ?? "—").trim() || "—",
    status: mapJiraStatus(issue.fields?.status),
    priority: mapJiraPriority(issue.fields?.priority?.name),
    assignee_id: assignee.id,
    assignee_name: assignee.name,
    assignee_role: assignee.role,
    assignee_color: assignee.color,
    story_points: readStoryPoints(issue.fields, storyField),
    updated_at: issue.fields?.updated ?? syncedAt,
    labels: issue.fields?.labels ?? [],
    synced_at: syncedAt,
    assignee_account_id: assignee.accountId,
    assignee_email: assignee.email,
    due_date: toDateOnly(issue.fields?.duedate),
    start_date: readJiraStartDate(issue.fields, startFieldId),
    created_at: toTimestamptz(issue.fields?.created),
    resolved_at: toTimestamptz(issue.fields?.resolutiondate),
    issue_type: issueType?.name ?? "",
    parent_issue_key: parent?.key ?? null,
    /** FK: 부모가 동일 배치에 없을 수 있어 키만 저장, id는 후처리 또는 null */
    parent_id: null,
    is_subtask: isSubtask,
    jira_status_name: issue.fields?.status?.name ?? "",
  };
}

export function jiraIssueFieldsQuery(storyField: string, startField = ""): string {
  const extra = [storyField, startField.trim()].filter(Boolean);
  return [...JIRA_ISSUE_FIELDS, ...extra].join(",");
}
