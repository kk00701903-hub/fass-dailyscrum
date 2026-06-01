import type { SupabaseClient } from "@supabase/supabase-js";
import type { JiraSprintUpsertRow } from "@/lib/jira-sprint-map";

/** Supabase SQL Editor 에 붙여넣을 마이그레이션 (WBS·동기화용) */
export const JIRA_SPRINTS_MIGRATION_SQL = `-- jira_sprints: WBS·동기화용 컬럼 (한 번만 실행)
alter table public.jira_sprints
  add column if not exists jira_sprint_id text,
  add column if not exists start_date date,
  add column if not exists end_date date;

create unique index if not exists jira_sprints_jira_sprint_id_key
  on public.jira_sprints (jira_sprint_id)
  where jira_sprint_id is not null;

notify pgrst, 'reload schema';
`;

function isMissingColumnError(message: string): boolean {
  return /end_date|start_date|jira_sprint_id|schema cache|column/i.test(message);
}

function toBasicPayload(rows: JiraSprintUpsertRow[], now: string) {
  return rows.map((r) => ({
    id: r.id,
    sprint_name: r.sprint_name,
    status: r.status,
    remaining_days: r.remaining_days,
    updated_at: now,
  }));
}

function toFullPayload(rows: JiraSprintUpsertRow[], now: string) {
  return rows.map((r) => ({
    id: r.id,
    sprint_name: r.sprint_name,
    status: r.status,
    remaining_days: r.remaining_days,
    jira_sprint_id: r.jira_sprint_id,
    start_date: r.start_date,
    end_date: r.end_date,
    updated_at: now,
  }));
}

/**
 * jira_sprints 전체 교체 삽입.
 * 확장 컬럼이 없으면 기본 컬럼만으로 재시도 (동기화는 되지만 WBS 연동은 마이그레이션 필요).
 */
export async function insertJiraSprintsReplace(
  supabase: SupabaseClient,
  rows: JiraSprintUpsertRow[]
): Promise<{ count: number; mode: "full" | "basic" }> {
  const now = new Date().toISOString();

  const { error: deleteError } = await supabase.from("jira_sprints").delete().not("sprint_name", "is", null);
  if (deleteError) throw new Error(`DB 삭제 실패: ${deleteError.message}`);

  if (rows.length === 0) return { count: 0, mode: "full" };

  const { error: fullError } = await supabase.from("jira_sprints").insert(toFullPayload(rows, now));
  if (!fullError) return { count: rows.length, mode: "full" };

  if (!isMissingColumnError(fullError.message)) {
    throw new Error(`DB 삽입 실패: ${fullError.message}`);
  }

  const { error: basicError } = await supabase.from("jira_sprints").insert(toBasicPayload(rows, now));
  if (basicError) {
    throw new Error(
      `DB 삽입 실패: ${basicError.message}\n\n` +
        `Supabase SQL Editor에서 다음을 실행하세요:\n${JIRA_SPRINTS_MIGRATION_SQL}`
    );
  }

  return {
    count: rows.length,
    mode: "basic",
  };
}
