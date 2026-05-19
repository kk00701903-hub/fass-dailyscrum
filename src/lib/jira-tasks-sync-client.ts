import { isJiraLiveFetchAvailable, jiraFetch } from "@/lib/jira-client";
import { getJiraBoardIdFromEnv, getJiraStoryPointsFieldIdFromEnv } from "@/lib/jira-env";
import {
  jiraIssueFieldsQuery,
  mapIssueToDbRow,
  type JiraIssueRaw,
  type JiraTaskDbRow,
} from "@/lib/jira-issue-mapper";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

interface JiraSprintApiValue {
  id: number;
  name: string;
  state: string;
}

function sprintIdFromJira(sp: JiraSprintApiValue): string {
  return `jira-sprint-${sp.id}`;
}

/** 보드 스프린트별 이슈·서브태스크 조회 (active/future + 최근 closed 3개) */
export async function fetchTasksFromJiraViaProxy(): Promise<JiraTaskDbRow[]> {
  if (!isJiraLiveFetchAvailable()) {
    throw new Error("JIRA 프록시를 사용할 수 없습니다. npm run dev 와 VITE_JIRA_* 를 확인하세요.");
  }

  const boardId = getJiraBoardIdFromEnv();
  if (!/^\d+$/.test(boardId)) {
    throw new Error("VITE_JIRA_BOARD_ID 를 숫자 보드 ID로 설정하세요.");
  }

  const storyField = getJiraStoryPointsFieldIdFromEnv();
  const fields = jiraIssueFieldsQuery(storyField);
  const syncedAt = new Date().toISOString();

  const sprintRes = await jiraFetch<{ values?: JiraSprintApiValue[] }>(
    `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&maxResults=50`
  );

  const sprints = sprintRes.values ?? [];
  const closed = sprints.filter((s) => s.state === "closed").slice(-3);
  const toSync = [...sprints.filter((s) => s.state === "active" || s.state === "future"), ...closed];

  const byId = new Map<string, JiraTaskDbRow>();

  for (const sp of toSync) {
    const sprintId = sprintIdFromJira(sp);
    let startAt = 0;
    const maxResults = 50;

    for (;;) {
      const path = `/rest/agile/1.0/sprint/${sp.id}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=${encodeURIComponent(fields)}`;
      const page = await jiraFetch<{ issues?: JiraIssueRaw[]; isLast?: boolean }>(path);
      const issues = page.issues ?? [];

      for (const issue of issues) {
        byId.set(issue.id, mapIssueToDbRow(issue, sprintId, storyField, syncedAt));
      }

      if (page.isLast === true || issues.length < maxResults) break;
      startAt += maxResults;
      if (startAt > 500) break;
    }
  }

  return [...byId.values()].sort((a, b) => a.issue_key.localeCompare(b.issue_key));
}

/** jira_tasks 전체 교체 */
export async function replaceJiraTasksInDb(rows: JiraTaskDbRow[]): Promise<number> {
  if (!isSupabaseConfigured()) {
    throw new Error("VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 설정하세요.");
  }

  const { error: deleteError } = await supabase.from("jira_tasks").delete().not("issue_key", "is", null);
  if (deleteError) throw new Error(`jira_tasks 삭제 실패: ${deleteError.message}`);

  if (rows.length === 0) return 0;

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: insertError } = await supabase.from("jira_tasks").insert(chunk);
    if (insertError) throw new Error(`jira_tasks 삽입 실패: ${insertError.message}`);
  }

  return rows.length;
}

export async function syncJiraTasksFromBrowser(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const rows = await fetchTasksFromJiraViaProxy();
    const count = await replaceJiraTasksInDb(rows);
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
