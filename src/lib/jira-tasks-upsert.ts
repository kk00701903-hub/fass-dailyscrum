import type { SupabaseClient } from "@supabase/supabase-js";
import type { JiraTaskDbRow } from "@/lib/jira-issue-mapper";

/** PostgREST upsert — JIRA REST `issue.id` (절대 불변) */
export const JIRA_TASKS_UPSERT_ON_CONFLICT = "jira_issue_id" as const;

export type JiraTaskUpsertRow = JiraTaskDbRow & {
  jira_issue_id: string;
};

/** DB 적재 전: jira_issue_id · parent_id · id 정규화 */
export function prepareJiraTaskRowsForUpsert(rows: JiraTaskDbRow[]): JiraTaskUpsertRow[] {
  const normalized = rows.map((r) => {
    const jiraIssueId = (r as JiraTaskUpsertRow).jira_issue_id ?? r.id;
    return {
      ...r,
      id: jiraIssueId,
      jira_issue_id: jiraIssueId,
      issue_key: r.issue_key?.trim() ?? "",
      summary: r.summary ?? "—",
      jira_status_name: r.jira_status_name ?? "",
    };
  });

  const keyToJiraId = new Map(normalized.map((r) => [r.issue_key, r.jira_issue_id]));

  return normalized.map((r) => ({
    ...r,
    parent_id: r.parent_issue_key
      ? (keyToJiraId.get(r.parent_issue_key) ?? r.parent_id ?? null)
      : (r.parent_id ?? null),
  }));
}

export type UpsertJiraTasksResult = {
  upserted: number;
  pruned: number;
};

type UpsertOptions = {
  /** false면 보드 밖 이슈 행 유지 (기본 true) */
  pruneStale?: boolean;
  logPrefix?: string;
};

function logUpsertChunkError(
  prefix: string,
  chunkIndex: number,
  chunk: JiraTaskUpsertRow[],
  error: { message?: string; code?: string; details?: string }
): void {
  console.error(`${prefix} upsert chunk failed`, {
    chunkIndex,
    count: chunk.length,
    issueKeys: chunk.map((r) => r.issue_key),
    jiraIssueIds: chunk.map((r) => r.jira_issue_id),
    message: error.message,
    code: error.code,
    details: error.details,
  });
}

/**
 * jira_tasks — delete+insert 대신 jira_issue_id upsert.
 * issue_key·summary·status 등은 항상 JIRA 최신값으로 덮어씀.
 */
export async function upsertJiraTasksInDb(
  client: SupabaseClient,
  rows: JiraTaskDbRow[],
  options: UpsertOptions = {}
): Promise<UpsertJiraTasksResult> {
  const prefix = options.logPrefix ?? "[jira-tasks-upsert]";
  const prepared = prepareJiraTaskRowsForUpsert(rows);
  const pruneStale = options.pruneStale !== false;

  if (prepared.length === 0) {
    if (pruneStale) {
      const { error } = await client.from("jira_tasks").delete().not("jira_issue_id", "is", null);
      if (error) {
        console.error(`${prefix} prune-all failed`, { message: error.message });
        throw new Error(`jira_tasks 전체 정리 실패: ${error.message}`);
      }
    }
    return { upserted: 0, pruned: 0 };
  }

  const chunkSize = 100;
  let upserted = 0;

  for (let i = 0; i < prepared.length; i += chunkSize) {
    const chunk = prepared.slice(i, i + chunkSize);
    const chunkIndex = Math.floor(i / chunkSize);

    try {
      const { error } = await client.from("jira_tasks").upsert(chunk, {
        onConflict: JIRA_TASKS_UPSERT_ON_CONFLICT,
        ignoreDuplicates: false,
      });

      if (error) {
        logUpsertChunkError(prefix, chunkIndex, chunk, error);
        throw new Error(
          `jira_tasks upsert 실패 [${chunk.map((r) => r.issue_key).join(", ")}]: ${error.message}`
        );
      }
      upserted += chunk.length;
    } catch (e) {
      if (e instanceof Error && e.message.includes("jira_tasks upsert")) throw e;
      console.error(`${prefix} unexpected error`, {
        chunkIndex,
        issueKeys: chunk.map((r) => r.issue_key),
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  let pruned = 0;
  if (pruneStale) {
    const keepIds = prepared.map((r) => r.jira_issue_id);
    const { error, count } = await client
      .from("jira_tasks")
      .delete({ count: "exact" })
      .not("jira_issue_id", "in", `(${keepIds.join(",")})`);

    if (error) {
      console.error(`${prefix} prune stale failed`, {
        keepCount: keepIds.length,
        message: error.message,
      });
      throw new Error(`jira_tasks 정리(보드 밖 이슈) 실패: ${error.message}`);
    }
    pruned = count ?? 0;
    if (pruned > 0) {
      console.info(`${prefix} pruned ${pruned} stale row(s) not in current JIRA fetch`);
    }
  }

  console.info(`${prefix} upserted ${upserted} issue(s) on conflict=${JIRA_TASKS_UPSERT_ON_CONFLICT}`);
  return { upserted, pruned };
}

/** @deprecated delete+insert — upsert 사용 */
export async function replaceJiraTasksInDb(
  client: SupabaseClient,
  rows: JiraTaskDbRow[]
): Promise<number> {
  const { upserted } = await upsertJiraTasksInDb(client, rows);
  return upserted;
}
