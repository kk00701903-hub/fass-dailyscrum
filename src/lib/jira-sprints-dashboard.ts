import { runBrowserJiraFullSync } from "@/lib/jira-browser-sync";
import { invokeProductionJiraSync } from "@/lib/jira-edge-sync";
import { canSyncJiraFromBrowser } from "@/lib/jira-env";
import { isJiraLiveFetchAvailable } from "@/lib/jira-client";
import { sortSprintsByNumber } from "@/lib/jira-sprint-sort";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** jira_sprints 테이블 행 */
export interface JiraSprintRow {
  id?: string;
  sprint_name: string;
  status: string;
  remaining_days: number;
  jira_sprint_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** jira_tasks 테이블 행 (동기화 페이지용) */
export interface JiraTaskRow {
  id: string;
  issue_key: string;
  sprint_id: string;
  summary: string;
  status: string;
  priority: string;
  assignee_name: string;
  assignee_color: string;
  story_points: number;
  due_date: string | null;
  start_date: string | null;
  created_at: string | null;
  resolved_at: string | null;
  jira_status_name: string;
  is_subtask: boolean;
  parent_issue_key: string | null;
}

export interface JiraSprintBoardRow extends JiraSprintRow {
  assignees: string[];
  taskCount: number;
}

export interface JiraSprintBoardData {
  sprints: JiraSprintBoardRow[];
  tasksBySprintId: Record<string, JiraTaskRow[]>;
}

/** Supabase DB에서 jira_sprints 전체 조회 (프론트 전용) */
export async function fetchJiraSprintsFromDb(): Promise<JiraSprintRow[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 설정하세요.");
  }

  const { data, error } = await supabase.from("jira_sprints").select("*").order("sprint_name", { ascending: true });

  if (error) throw new Error(error.message);

  return sortSprintsByNumber((data ?? []).map(mapSprintDbRow));
}

function mapSprintDbRow(row: Record<string, unknown>): JiraSprintRow {
  return {
    id: row.id as string | undefined,
    sprint_name: String(row.sprint_name ?? row.name ?? ""),
    status: String(row.status ?? row.state ?? ""),
    remaining_days: Number(row.remaining_days ?? 0),
    jira_sprint_id: row.jira_sprint_id ? String(row.jira_sprint_id) : null,
    start_date: row.start_date ? String(row.start_date).slice(0, 10) : null,
    end_date: row.end_date ? String(row.end_date).slice(0, 10) : null,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function mapTaskDbRow(row: Record<string, unknown>): JiraTaskRow {
  return {
    id: String(row.id),
    issue_key: String(row.issue_key ?? ""),
    sprint_id: String(row.sprint_id ?? ""),
    summary: String(row.summary ?? ""),
    status: String(row.status ?? "TODO"),
    priority: String(row.priority ?? "MEDIUM"),
    assignee_name: String(row.assignee_name ?? "미배정"),
    assignee_color: String(row.assignee_color ?? "#64748b"),
    story_points: Number(row.story_points ?? 0),
    due_date: row.due_date ? String(row.due_date).slice(0, 10) : null,
    start_date: row.start_date ? String(row.start_date).slice(0, 10) : null,
    created_at: row.created_at ? String(row.created_at).slice(0, 10) : null,
    resolved_at: row.resolved_at ? String(row.resolved_at) : null,
    jira_status_name: String(row.jira_status_name ?? ""),
    is_subtask: Boolean(row.is_subtask),
    parent_issue_key: row.parent_issue_key ? String(row.parent_issue_key) : null,
  };
}

export function formatAssigneeLabel(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n || n === "Unknown" || n === "—") return "미배정";
  return n;
}

function uniqueAssignees(tasks: JiraTaskRow[]): string[] {
  const names = new Set<string>();
  for (const t of tasks) {
    const n = formatAssigneeLabel(t.assignee_name);
    if (n !== "미배정") names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ko"));
}

/** 스프린트 + 태스크 묶음 (담당자·일정·펼치기용) */
export async function fetchJiraSprintBoardFromDb(): Promise<JiraSprintBoardData> {
  if (!isSupabaseConfigured()) {
    throw new Error("VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 설정하세요.");
  }

  const [sprintRes, taskRes] = await Promise.all([
    supabase.from("jira_sprints").select("*").order("sprint_name", { ascending: true }),
    supabase
      .from("jira_tasks")
      .select(
        "id, issue_key, sprint_id, summary, status, priority, assignee_name, assignee_color, story_points, due_date, start_date, created_at, resolved_at, jira_status_name, is_subtask, parent_issue_key"
      )
      .order("issue_key", { ascending: true }),
  ]);

  if (sprintRes.error) throw new Error(sprintRes.error.message);
  if (taskRes.error) throw new Error(taskRes.error.message);

  const tasksBySprintId: Record<string, JiraTaskRow[]> = {};
  for (const raw of taskRes.data ?? []) {
    const task = mapTaskDbRow(raw as Record<string, unknown>);
    if (!task.sprint_id) continue;
    (tasksBySprintId[task.sprint_id] ??= []).push(task);
  }

  const sprints: JiraSprintBoardRow[] = (sprintRes.data ?? []).map((raw) => {
    const sprint = mapSprintDbRow(raw as Record<string, unknown>);
    const linkId = sprint.jira_sprint_id ?? "";
    const tasks = linkId ? (tasksBySprintId[linkId] ?? []) : [];
    return {
      ...sprint,
      assignees: uniqueAssignees(tasks),
      taskCount: tasks.length,
    };
  });

  return { sprints: sortSprintsByNumber(sprints), tasksBySprintId };
}

export interface JiraSyncRunSummary {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  sprints_count: number;
  tasks_count: number;
  error_message: string | null;
}

/** Edge Function 배치 이력 (없으면 null) */
export async function fetchLatestJiraSyncRun(): Promise<JiraSyncRunSummary | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from("jira_sync_runs")
    .select("id, started_at, finished_at, status, sprints_count, tasks_count, error_message")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: String(data.id),
    started_at: String(data.started_at),
    finished_at: data.finished_at ? String(data.finished_at) : null,
    status: data.status as JiraSyncRunSummary["status"],
    sprints_count: Number(data.sprints_count ?? 0),
    tasks_count: Number(data.tasks_count ?? 0),
    error_message: data.error_message ? String(data.error_message) : null,
  };
}

/** JIRA API → DB 전체 교체 (개발: 프록시 직접 / 운영: Edge Function) */
export async function invokeJiraSprintSync(): Promise<{
  ok: boolean;
  count?: number;
  tasksCount?: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 설정하세요." };
  }

  if (import.meta.env.DEV && isJiraLiveFetchAvailable()) {
    return runBrowserJiraFullSync();
  }

  const edge = await invokeProductionJiraSync();
  if (edge.ok && (edge.tasksCount ?? 0) > 0) {
    return { ok: true, count: edge.count, tasksCount: edge.tasksCount };
  }

  if (edge.ok && (edge.tasksCount ?? 0) === 0) {
    return {
      ok: false,
      count: edge.count,
      error: edge.error ?? "JIRA 이슈(FWK)가 DB에 반영되지 않았습니다.",
    };
  }

  const edgeMissing = /not found|404|non-2xx|Edge Function not found/i.test(edge.error ?? "");
  if (edgeMissing && canSyncJiraFromBrowser()) {
    const browser = await runBrowserJiraFullSync();
    if (browser.ok) return browser;
    return {
      ok: false,
      error:
        `${browser.error ?? edge.error ?? "동기화 실패"}` +
        " — Supabase Edge Function 배포: Actions「Deploy Supabase Edge」또는 `npx supabase functions deploy sync-jira-all jira-proxy`",
    };
  }

  return {
    ok: false,
    error:
      (edge.error ?? "JIRA 동기화에 실패했습니다.") +
      " — GitHub Actions「Deploy Supabase Edge」실행 또는 일일 배치 JIRA Sync 를 사용하세요.",
  };
}

export const JIRA_DATA_CHANNEL = "jira-data-dashboard";

/** Realtime: jira_sprints · jira_tasks 변경 시 (수동 동기화·GitHub 09:00 배치 반영) */
export function subscribeJiraSprints(onChange: () => void): () => void {
  const channel = supabase
    .channel(JIRA_DATA_CHANNEL)
    .on("postgres_changes", { event: "*", schema: "public", table: "jira_sprints" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "jira_tasks" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "jira_dependencies" }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
