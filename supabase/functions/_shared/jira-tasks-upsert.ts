import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const JIRA_TASKS_UPSERT_ON_CONFLICT = "jira_issue_id";

export type JiraTaskUpsertRow = Record<string, unknown> & {
  id: string;
  jira_issue_id: string;
  issue_key: string;
};

export function prepareJiraTaskRowsForUpsert(
  rows: Array<Record<string, unknown>>
): JiraTaskUpsertRow[] {
  const normalized = rows.map((r) => {
    const id = String(r.id ?? "");
    const jiraIssueId = String(r.jira_issue_id ?? id);
    return {
      ...r,
      id: jiraIssueId,
      jira_issue_id: jiraIssueId,
      issue_key: String(r.issue_key ?? "").trim(),
      summary: String(r.summary ?? "—").trim() || "—",
      jira_status_name: String(r.jira_status_name ?? ""),
    } as JiraTaskUpsertRow;
  });

  const keyToJiraId = new Map(normalized.map((r) => [r.issue_key, r.jira_issue_id]));

  return normalized.map((r) => ({
    ...r,
    parent_id: r.parent_issue_key
      ? (keyToJiraId.get(String(r.parent_issue_key)) ?? r.parent_id ?? null)
      : (r.parent_id ?? null),
  }));
}

function logChunkError(
  prefix: string,
  chunkIndex: number,
  chunk: JiraTaskUpsertRow[],
  error: { message?: string; code?: string; details?: string }
): void {
  console.error(`${prefix} upsert chunk failed`, {
    chunkIndex,
    issueKeys: chunk.map((r) => r.issue_key),
    jiraIssueIds: chunk.map((r) => r.jira_issue_id),
    message: error.message,
    code: error.code,
    details: error.details,
  });
}

export async function upsertJiraTasksInDb(
  client: SupabaseClient,
  rows: Array<Record<string, unknown>>,
  options: { pruneStale?: boolean; logPrefix?: string } = {}
): Promise<{ upserted: number; pruned: number }> {
  const prefix = options.logPrefix ?? "[jira-tasks-upsert]";
  const prepared = prepareJiraTaskRowsForUpsert(rows);
  const pruneStale = options.pruneStale !== false;

  if (prepared.length === 0) {
    if (pruneStale) {
      const { error } = await client.from("jira_tasks").delete().not("jira_issue_id", "is", null);
      if (error) throw new Error(`jira_tasks clear failed: ${error.message}`);
    }
    return { upserted: 0, pruned: 0 };
  }

  const chunkSize = 100;
  let upserted = 0;

  for (let i = 0; i < prepared.length; i += chunkSize) {
    const chunk = prepared.slice(i, i + chunkSize);
    const chunkIndex = Math.floor(i / chunkSize);
    const { error } = await client.from("jira_tasks").upsert(chunk, {
      onConflict: JIRA_TASKS_UPSERT_ON_CONFLICT,
      ignoreDuplicates: false,
    });
    if (error) {
      logChunkError(prefix, chunkIndex, chunk, error);
      throw new Error(
        `jira_tasks upsert failed [${chunk.map((r) => r.issue_key).join(", ")}]: ${error.message}`
      );
    }
    upserted += chunk.length;
  }

  let pruned = 0;
  if (pruneStale) {
    const keepIds = prepared.map((r) => r.jira_issue_id);
    const { error, count } = await client
      .from("jira_tasks")
      .delete({ count: "exact" })
      .not("jira_issue_id", "in", `(${keepIds.join(",")})`);
    if (error) throw new Error(`jira_tasks prune failed: ${error.message}`);
    pruned = count ?? 0;
  }

  console.info(`${prefix} upserted ${upserted} on ${JIRA_TASKS_UPSERT_ON_CONFLICT}`);
  return { upserted, pruned };
}
