import { runBrowserJiraFullSync } from "@/lib/jira-browser-sync";
import { invokeProductionJiraSync } from "@/lib/jira-edge-sync";
import { canSyncJiraFromBrowser } from "@/lib/jira-env";
import { isJiraLiveFetchAvailable } from "@/lib/jira-client";
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
    return runBrowserJiraFullSync();
  }

  const edge = await invokeProductionJiraSync();
  if (edge.ok) {
    return { ok: true, count: edge.count, tasksCount: edge.tasksCount };
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
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
