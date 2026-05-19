import { isJiraLiveFetchAvailable, jiraFetch } from "@/lib/jira-client";
import { getJiraBoardIdFromEnv } from "@/lib/jira-env";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export interface JiraSprintUpsertRow {
  sprint_name: string;
  status: string;
  remaining_days: number;
}

interface JiraSprintApiValue {
  id: number;
  name: string;
  state: string;
  endDate?: string;
}

function statusLabel(state: string): string {
  if (state === "active") return "진행 중";
  if (state === "closed") return "종료";
  if (state === "future") return "예정";
  return state;
}

function remainingDays(endDate?: string): number {
  if (!endDate) return 0;
  const end = new Date(`${endDate.slice(0, 10)}T12:00:00`);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

function mapSprintRow(sp: JiraSprintApiValue): JiraSprintUpsertRow {
  return {
    sprint_name: sp.name,
    status: statusLabel(sp.state),
    remaining_days: remainingDays(sp.endDate),
  };
}

/** 개발 모드: Vite JIRA 프록시로 스프린트 전체 조회 */
export async function fetchSprintsFromJiraViaProxy(): Promise<JiraSprintUpsertRow[]> {
  if (!isJiraLiveFetchAvailable()) {
    throw new Error("JIRA 프록시를 사용할 수 없습니다. npm run dev 와 VITE_JIRA_* 환경 변수를 확인하세요.");
  }

  const boardId = getJiraBoardIdFromEnv();
  if (!/^\d+$/.test(boardId)) {
    throw new Error("VITE_JIRA_BOARD_ID 를 숫자 보드 ID로 설정하세요.");
  }

  const maxResults = 50;
  const all: JiraSprintApiValue[] = [];
  let startAt = 0;

  for (;;) {
    const path = `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&startAt=${startAt}&maxResults=${maxResults}`;
    const page = await jiraFetch<{ values?: JiraSprintApiValue[]; isLast?: boolean }>(path);
    const values = page.values ?? [];
    all.push(...values);
    if (page.isLast === true || values.length < maxResults) break;
    startAt += maxResults;
    if (startAt > 500) break;
  }

  const byName = new Map<string, JiraSprintUpsertRow>();
  for (const sp of all) {
    if (!sp.name?.trim()) continue;
    byName.set(sp.name, mapSprintRow(sp));
  }
  return [...byName.values()].sort((a, b) => a.sprint_name.localeCompare(b.sprint_name, "ko"));
}

/** Supabase jira_sprints 전체 교체 (anon RLS) */
export async function replaceJiraSprintsInDb(rows: JiraSprintUpsertRow[]): Promise<number> {
  if (!isSupabaseConfigured()) {
    throw new Error("VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 설정하세요.");
  }

  const now = new Date().toISOString();

  const { error: deleteError } = await supabase.from("jira_sprints").delete().not("sprint_name", "is", null);
  if (deleteError) throw new Error(`DB 삭제 실패: ${deleteError.message}`);

  if (rows.length === 0) return 0;

  const payload = rows.map((r) => ({
    sprint_name: r.sprint_name,
    status: r.status,
    remaining_days: r.remaining_days,
    updated_at: now,
  }));

  const { error: insertError } = await supabase.from("jira_sprints").insert(payload);
  if (insertError) throw new Error(`DB 삽입 실패: ${insertError.message}`);

  return rows.length;
}

/** 개발: 브라우저에서 JIRA 프록시 → Supabase 직접 동기화 */
export async function syncJiraSprintsFromBrowser(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const rows = await fetchSprintsFromJiraViaProxy();
    const count = await replaceJiraSprintsInDb(rows);
    return { ok: true, count };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
