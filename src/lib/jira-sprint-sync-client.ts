import { jiraFetch } from "@/lib/jira-client";
import { canSyncJiraFromBrowser, getJiraBoardIdFromEnv } from "@/lib/jira-env";
import {
  mapApiSprintToUpsertRow,
  type JiraSprintApiValue,
  type JiraSprintUpsertRow,
} from "@/lib/jira-sprint-map";
import { insertJiraSprintsReplace, JIRA_SPRINTS_MIGRATION_SQL } from "@/lib/jira-sprints-db";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export type { JiraSprintUpsertRow };

/** 개발 모드: Vite JIRA 프록시로 스프린트 전체 조회 */
export async function fetchSprintsFromJiraViaProxy(): Promise<JiraSprintUpsertRow[]> {
  if (!canSyncJiraFromBrowser()) {
    throw new Error("JIRA 동기화 설정을 확인하세요. VITE_JIRA_* · VITE_SUPABASE_* 환경 변수가 필요합니다.");
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
    byName.set(sp.name, mapApiSprintToUpsertRow(sp));
  }
  return [...byName.values()].sort((a, b) => a.sprint_name.localeCompare(b.sprint_name, "ko"));
}

/** Supabase jira_sprints 전체 교체 (anon RLS) */
export async function replaceJiraSprintsInDb(rows: JiraSprintUpsertRow[]): Promise<number> {
  if (!isSupabaseConfigured()) {
    throw new Error("VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 설정하세요.");
  }

  const { count, mode } = await insertJiraSprintsReplace(supabase, rows);
  if (mode === "basic" && count > 0) {
    console.warn(
      "[jira] jira_sprints 확장 컬럼 없음 — 기본 컬럼만 저장됨. WBS 연동을 위해 Supabase SQL Editor에서 마이그레이션 실행:\n",
      JIRA_SPRINTS_MIGRATION_SQL
    );
  }
  return count;
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
