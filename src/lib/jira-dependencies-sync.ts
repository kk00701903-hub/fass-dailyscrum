import type { JiraDependencyUpsert } from "@/lib/jira-dependencies";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function isMissingJiraSourceColumn(message: string): boolean {
  return /source|jira_link_id|schema cache|does not exist/i.test(message);
}

/** JIRA issuelink 동기화 결과를 DB에 반영 (기존 jira 출처 삭제 후 삽입) */
export async function replaceJiraSyncedDependencies(rows: JiraDependencyUpsert[]): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const { error: delError } = await supabase.from("jira_dependencies").delete().eq("source", "jira");
  if (delError && !isMissingJiraSourceColumn(delError.message)) {
    throw new Error(`JIRA 의존성 삭제 실패: ${delError.message}`);
  }
  if (delError) {
    console.warn(
      "[jira] jira_dependencies.source 컬럼 없음 — 링크 동기화 스킵. supabase/migrations/20260524120000_jira_dependencies_jira_source.sql 실행"
    );
    return 0;
  }

  if (rows.length === 0) return 0;

  const payload = rows.map((r) => ({
    source_kind: r.source_kind,
    source_ref: r.source_ref,
    target_kind: r.target_kind,
    target_ref: r.target_ref,
    relation: r.relation,
    source: r.source,
    jira_link_id: r.jira_link_id,
    note: r.note,
    updated_at: new Date().toISOString(),
  }));

  const chunkSize = 100;
  let inserted = 0;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from("jira_dependencies").insert(chunk);
    if (error) throw new Error(`JIRA 의존성 삽입 실패: ${error.message}`);
    inserted += chunk.length;
  }

  return inserted;
}
