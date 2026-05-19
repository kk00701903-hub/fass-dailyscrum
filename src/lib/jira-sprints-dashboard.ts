import { isJiraLiveFetchAvailable } from "@/lib/jira-client";
import { syncJiraSprintsFromBrowser } from "@/lib/jira-sprint-sync-client";
import { syncJiraTasksFromBrowser } from "@/lib/jira-tasks-sync-client";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** jira_sprints 테이블 행 (sprint_name, status, remaining_days) */
export interface JiraSprintRow {
  id?: string;
  sprint_name: string;
  status: string;
  remaining_days: number;
  created_at?: string;
  updated_at?: string;
}

/** Supabase DB에서 jira_sprints 전체 조회 (프론트 전용) */
export async function fetchJiraSprintsFromDb(): Promise<JiraSprintRow[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 설정하세요.");
  }

  const { data, error } = await supabase.from("jira_sprints").select("*").order("sprint_name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string | undefined,
    sprint_name: String(row.sprint_name ?? row.name ?? ""),
    status: String(row.status ?? row.state ?? ""),
    remaining_days: Number(row.remaining_days ?? 0),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  }));
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
    const sprints = await syncJiraSprintsFromBrowser();
    if (!sprints.ok) {
      return { ok: false, error: sprints.error ?? "스프린트 동기화에 실패했습니다." };
    }
    const tasks = await syncJiraTasksFromBrowser();
    if (!tasks.ok) {
      return { ok: false, count: sprints.count, error: tasks.error ?? "이슈 동기화에 실패했습니다." };
    }
    return { ok: true, count: sprints.count, tasksCount: tasks.count };
  }

  const { data, error } = await supabase.functions.invoke("sync-jira-sprints", { body: {} });

  if (error) {
    const msg = error.message || String(error);
    const hint =
      /failed to send|not found|404|non-2xx/i.test(msg)
        ? " Supabase에 `supabase functions deploy sync-jira-sprints` 로 배포하거나, 터미널에서 `npm run sync:jira` 를 실행하세요."
        : "";
    return { ok: false, error: `${msg}${hint}` };
  }

  const payload = data as { ok?: boolean; error?: string; count?: number } | null;
  if (payload?.error) {
    return { ok: false, error: payload.error, count: payload.count };
  }

  return {
    ok: payload?.ok !== false,
    count: typeof payload?.count === "number" ? payload.count : undefined,
  };
}

export const JIRA_DATA_CHANNEL = "jira-data-dashboard";

/** Realtime: jira_sprints · jira_tasks 변경 시 (수동 동기화·GitHub 09:00 배치 반영) */
export function subscribeJiraSprints(onChange: () => void): () => void {
  const channel = supabase
    .channel(JIRA_DATA_CHANNEL)
    .on("postgres_changes", { event: "*", schema: "public", table: "jira_sprints" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "jira_tasks" }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
