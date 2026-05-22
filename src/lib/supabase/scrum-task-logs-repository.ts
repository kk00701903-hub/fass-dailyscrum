import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { ScrumTaskLogRow } from "@/lib/scrum-task-fields";

type DbRow = {
  issue_key: string;
  jira_issue_id: string | null;
  yesterday: string;
  today: string;
};

export async function fetchScrumTaskLogs(
  memberId: string,
  entryDate: string,
  sprintId: string
): Promise<ScrumTaskLogRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase()
    .from("scrum_task_logs")
    .select("issue_key, jira_issue_id, yesterday, today")
    .eq("member_id", memberId)
    .eq("entry_date", entryDate)
    .eq("sprint_id", sprintId);

  if (error) {
    if (/does not exist|Could not find/i.test(error.message)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const r = row as DbRow;
    return {
      issueKey: String(r.issue_key),
      jiraIssueId: r.jira_issue_id ? String(r.jira_issue_id) : null,
      yesterday: String(r.yesterday ?? ""),
      today: String(r.today ?? ""),
    };
  });
}

/** 선택된 이슈만 upsert, 목록에서 빠진 이슈는 삭제 */
export async function batchUpsertScrumTaskLogs(payload: {
  memberId: string;
  entryDate: string;
  sprintId: string;
  rows: ScrumTaskLogRow[];
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabase();
  const issueKeys = payload.rows.map((r) => r.issueKey);

  const { error: delErr } = await supabase
    .from("scrum_task_logs")
    .delete()
    .eq("member_id", payload.memberId)
    .eq("entry_date", payload.entryDate)
    .eq("sprint_id", payload.sprintId);
  if (delErr && !/does not exist|Could not find/i.test(delErr.message)) {
    throw new Error(delErr.message);
  }

  if (payload.rows.length === 0) return;

  const dbRows = payload.rows.map((r) => ({
    entry_date: payload.entryDate,
    sprint_id: payload.sprintId,
    member_id: payload.memberId,
    issue_key: r.issueKey,
    jira_issue_id: r.jiraIssueId,
    yesterday: r.yesterday,
    today: r.today,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("scrum_task_logs").upsert(dbRows, {
    onConflict: "entry_date,sprint_id,member_id,issue_key",
  });
  if (error) throw new Error(error.message);
}
