import type { JiraTask, Priority, ScrumEntry, Sprint, TaskStatus, TeamMember } from "@/lib/index";
import { TEAM_MEMBERS } from "@/lib/index";
import { jiraSprintRowToSprint } from "@/lib/sprint-status";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

interface SprintRow {
  id: string;
  sprint_name: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  jira_sprint_id?: string | null;
  remaining_days?: number | null;
  updated_at?: string | null;
}

interface TaskRow {
  id: string;
  issue_key: string;
  sprint_id: string;
  summary: string;
  status: string;
  priority: string;
  assignee_id: string;
  assignee_name: string;
  assignee_role: string;
  assignee_color: string;
  story_points: number;
  updated_at: string;
  labels: string[] | null;
  due_date?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
  issue_type?: string | null;
  parent_issue_key?: string | null;
  parent_id?: string | null;
  is_subtask?: boolean | null;
  jira_status_name?: string | null;
}

interface ScrumEntryRow {
  id: string;
  entry_date: string;
  sprint_id: string;
  member_id: string;
  yesterday: string;
  today: string;
  blockers: string;
  selected_tasks: string[];
}

function rowToAssignee(row: TaskRow): TeamMember {
  const known = TEAM_MEMBERS.find((m) => m.id === row.assignee_id);
  if (known) return known;
  return {
    id: row.assignee_id,
    name: row.assignee_name,
    avatar: (row.assignee_name[0] ?? "?").toUpperCase(),
    role: row.assignee_role,
    color: row.assignee_color,
  };
}

function rowToSprint(row: SprintRow): Sprint {
  return jiraSprintRowToSprint({
    id: row.id,
    jira_sprint_id: row.jira_sprint_id,
    sprint_name: row.sprint_name,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
  });
}

/** DB 행 → JiraTask (통합테스트·검증 스크립트용) */
export function jiraTaskFromDbRow(row: TaskRow): JiraTask {
  return rowToTask(row);
}

function rowToTask(row: TaskRow): JiraTask {
  return {
    id: row.id,
    key: row.issue_key,
    summary: row.summary,
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    assignee: rowToAssignee(row),
    storyPoints: Number(row.story_points) || 0,
    updatedAt: row.updated_at,
    labels: row.labels ?? [],
    sprintId: row.sprint_id,
    dueDate: row.due_date ?? null,
    createdAt: row.created_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    issueType: row.issue_type ?? "",
    parentIssueKey: row.parent_issue_key ?? null,
    parentId: row.parent_id ?? null,
    isSubtask: Boolean(row.is_subtask),
    jiraStatusName: row.jira_status_name ?? "",
  };
}

function rowToScrumEntry(row: ScrumEntryRow): ScrumEntry {
  const entry = {
    id: row.id,
    date: row.entry_date,
    sprintId: row.sprint_id,
    memberId: row.member_id,
    yesterday: row.yesterday,
    today: row.today,
    blockers: row.blockers,
    selectedTasks: row.selected_tasks ?? [],
  };

  return entry;
}

export async function invokeJiraSync(): Promise<{
  ok: boolean;
  sprintsCount?: number;
  tasksCount?: number;
  error?: string;
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("jira-sync", { body: {} });
  if (error) {
    return { ok: false, error: error.message };
  }
  const payload = data as { ok?: boolean; error?: string; sprintsCount?: number; tasksCount?: number };
  if (payload?.error) {
    return { ok: false, error: payload.error, sprintsCount: payload.sprintsCount, tasksCount: payload.tasksCount };
  }
  return {
    ok: Boolean(payload?.ok),
    sprintsCount: payload?.sprintsCount,
    tasksCount: payload?.tasksCount,
    error: payload?.error,
  };
}

export async function fetchSprintsFromDb(): Promise<Sprint[]> {
  const { data, error } = await getSupabase()
    .from("jira_sprints")
    .select("id, sprint_name, status, start_date, end_date, jira_sprint_id, remaining_days, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SprintRow[] ?? []).map(rowToSprint);
}

export async function fetchTasksFromDb(): Promise<JiraTask[]> {
  const { data, error } = await getSupabase()
    .from("jira_tasks")
    .select(
      "id, issue_key, sprint_id, summary, status, priority, assignee_id, assignee_name, assignee_role, assignee_color, story_points, updated_at, labels, due_date, created_at, resolved_at, issue_type, parent_issue_key, parent_id, is_subtask, jira_status_name"
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as TaskRow[] ?? []).map(rowToTask);
}

export async function fetchScrumEntriesFromDb(): Promise<ScrumEntry[]> {
  const { data, error } = await getSupabase()
    .from("scrum_entries")
    .select("id, entry_date, sprint_id, member_id, yesterday, today, blockers, selected_tasks")
    .order("entry_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ScrumEntryRow[] ?? []).map(rowToScrumEntry);
}

export async function fetchScrumEntriesByDate(entryDate: string): Promise<ScrumEntry[]> {
  const { data, error } = await getSupabase()
    .from("scrum_entries")
    .select("id, entry_date, sprint_id, member_id, yesterday, today, blockers, selected_tasks")
    .eq("entry_date", entryDate)
    .order("member_id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ScrumEntryRow[] ?? []).map(rowToScrumEntry);
}

export async function upsertScrumEntryToDb(entry: Omit<ScrumEntry, "id"> & { id?: string }): Promise<ScrumEntry> {
  const row = {
    entry_date: entry.date,
    sprint_id: entry.sprintId,
    member_id: entry.memberId,
    yesterday: entry.yesterday,
    today: entry.today,
    blockers: entry.blockers,
    selected_tasks: entry.selectedTasks,
  };

  const { data, error } = await getSupabase()
    .from("scrum_entries")
    .upsert(row, { onConflict: "entry_date,sprint_id,member_id" })
    .select("id, entry_date, sprint_id, member_id, yesterday, today, blockers, selected_tasks")
    .single();

  if (error) throw new Error(error.message);
  return rowToScrumEntry(data as ScrumEntryRow);
}

export function isSupabaseDataLayerReady(): boolean {
  return isSupabaseConfigured();
}
