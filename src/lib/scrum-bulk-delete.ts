import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const DELETE_BATCH = 200;

export type BulkDeleteTableResult = {
  table: string;
  label: string;
  deleted: number;
  skipped?: boolean;
};

export type BulkDeleteScrumDataResult = {
  ok: boolean;
  tables: BulkDeleteTableResult[];
  totalDeleted: number;
  error?: string;
};

async function fetchAllIds(table: string): Promise<string[]> {
  const { data, error } = await supabase.from(table).select("id");
  if (error) throw error;
  return (data ?? [])
    .map((row) => (row as { id?: string }).id)
    .filter((id): id is string => Boolean(id));
}

async function deleteIds(table: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    const chunk = ids.slice(i, i + DELETE_BATCH);
    const { error } = await supabase.from(table).delete().in("id", chunk);
    if (error) throw error;
  }
}

async function deleteAllFromTable(table: string, label: string): Promise<BulkDeleteTableResult> {
  try {
    const ids = await fetchAllIds(table);
    if (ids.length === 0) {
      return { table, label, deleted: 0 };
    }
    await deleteIds(table, ids);
    return { table, label, deleted: ids.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/does not exist|Could not find/i.test(message)) {
      return { table, label, deleted: 0, skipped: true };
    }
    throw new Error(`${label}: ${message}`);
  }
}

function isSmokeSprintName(name: string): boolean {
  return name.includes("[smoke-") || (/smoke/i.test(name) && name.length < 80);
}

async function deleteSmokeJiraSprints(): Promise<BulkDeleteTableResult> {
  const label = "jira_sprints (스모크 테스트)";
  const table = "jira_sprints";
  try {
    const { data, error } = await supabase.from(table).select("id, sprint_name");
    if (error) {
      if (/does not exist|Could not find/i.test(error.message)) {
        return { table, label, deleted: 0, skipped: true };
      }
      throw error;
    }
    const smoke = (data ?? []).filter((row) =>
      isSmokeSprintName(String((row as { sprint_name?: string }).sprint_name ?? ""))
    );
    const ids = smoke
      .map((row) => (row as { id?: string }).id)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      return { table, label, deleted: 0 };
    }
    await deleteIds(table, ids);
    return { table, label, deleted: ids.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`${label}: ${message}`);
  }
}

/**
 * 스크럼·일지 사용자 데이터 일괄 삭제 (JIRA 이슈·의존성·팀 설정은 유지).
 * `scripts/clear-test-data.mjs` 와 동일한 범위.
 */
export async function bulkDeleteScrumUserData(): Promise<BulkDeleteScrumDataResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      tables: [],
      totalDeleted: 0,
      error: "Supabase가 설정되지 않았습니다. VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY를 확인하세요.",
    };
  }

  const tables: BulkDeleteTableResult[] = [];
  try {
    tables.push(await deleteAllFromTable("daily_reports", "팀 일지 (daily_reports)"));
    tables.push(await deleteAllFromTable("scrum_entries", "데일리 스크럼 (scrum_entries)"));
    tables.push(
      await deleteAllFromTable("scrum_member_sprints", "담당자 스프린트 등록 (scrum_member_sprints)")
    );
    tables.push(await deleteSmokeJiraSprints());
    const totalDeleted = tables.reduce((sum, t) => sum + t.deleted, 0);
    return { ok: true, tables, totalDeleted };
  } catch (e) {
    return {
      ok: false,
      tables,
      totalDeleted: tables.reduce((sum, t) => sum + t.deleted, 0),
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
