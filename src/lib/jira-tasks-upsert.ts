import type { SupabaseClient } from "@supabase/supabase-js";
import type { JiraTaskDbRow } from "@/lib/jira-issue-mapper";

/** PostgREST upsert — JIRA REST `issue.id` (절대 불변) */
export const JIRA_TASKS_UPSERT_ON_CONFLICT = "jira_issue_id" as const;

export type JiraTaskUpsertRow = JiraTaskDbRow & {
  jira_issue_id: string;
  /** JIRA parent issue.id (FK 해석용, DB 컬럼 아님) */
  parent_jira_issue_id?: string | null;
};

export type UpsertJiraTasksResult = {
  upserted: number;
  pruned: number;
  /** issue_key 변경 (동일 jira_issue_id): oldKey → newKey — scrum_entries 마이그레이션용 */
  keyMigrations: Map<string, string>;
};

type UpsertOptions = {
  /** false면 보드 밖 이슈 행 유지 (기본 true = DELETE 동기화) */
  pruneStale?: boolean;
  logPrefix?: string;
};

function formatJiraTasksDbError(context: string, message: string): string {
  if (/jira_issue_id.*does not exist/i.test(message)) {
    return (
      `${context}: ${message} — Supabase Dashboard → SQL Editor에서 ` +
      "`scripts/apply-jira-issue-id-migration.sql` (또는 migrations 20260526120000 + 20260527120000) 실행 후 `notify pgrst, 'reload schema';`"
    );
  }
  if (/jira_tasks_parent_id_fkey/i.test(message)) {
    return (
      `${context}: ${message} — 부모 이슈가 동기화 배치에 없거나 삽입 순서 문제입니다. ` +
      "앱·Edge 최신 코드(2단계 upsert) 배포 후 다시 동기화하세요."
    );
  }
  return `${context}: ${message}`;
}

/** 동기화 직전 DB 스냅샷 — issue_key 변경 감지 */
export async function fetchJiraIssueKeySnapshot(
  client: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await client
      .from("jira_tasks")
      .select("jira_issue_id, issue_key")
      .order("jira_issue_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(
        formatJiraTasksDbError("jira_tasks 스냅샷 조회 실패", error.message)
      );
    }
    const rows = data ?? [];
    for (const row of rows) {
      const id = String(row.jira_issue_id ?? "").trim();
      if (!id) continue;
      map.set(id, String(row.issue_key ?? "").trim());
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return map;
}

/** 동일 jira_issue_id 에서 issue_key 만 바뀐 경우 (FWK-164 → FWK-220) */
export function buildIssueKeyMigrationMap(
  before: Map<string, string>,
  rows: Iterable<JiraTaskUpsertRow>
): Map<string, string> {
  const migrations = new Map<string, string>();
  for (const row of rows) {
    const id = row.jira_issue_id;
    const newKey = row.issue_key?.trim() ?? "";
    const oldKey = before.get(id);
    if (oldKey && newKey && oldKey !== newKey) {
      migrations.set(oldKey, newKey);
    }
  }
  return migrations;
}

/** DB 적재 전: jira_issue_id · parent_id(id) · 가변 필드 정규화 */
export function prepareJiraTaskRowsForUpsert(rows: JiraTaskDbRow[]): JiraTaskUpsertRow[] {
  const normalized: JiraTaskUpsertRow[] = rows.map((r) => {
    const jiraIssueId = String((r as JiraTaskUpsertRow).jira_issue_id ?? r.id).trim();
    const parentJiraId =
      (r as JiraTaskUpsertRow).parent_jira_issue_id?.trim() ||
      null;
    return {
      ...r,
      id: jiraIssueId,
      jira_issue_id: jiraIssueId,
      issue_key: r.issue_key?.trim() ?? "",
      summary: (r.summary ?? "—").trim() || "—",
      jira_status_name: r.jira_status_name ?? "",
      parent_jira_issue_id: parentJiraId,
    };
  });

  const jiraIdSet = new Set(normalized.map((r) => r.jira_issue_id));
  const keyToJiraId = new Map(
    normalized.filter((r) => r.issue_key).map((r) => [r.issue_key, r.jira_issue_id])
  );

  return normalized.map((r) => {
    let parentId: string | null = null;
    if (r.parent_jira_issue_id && jiraIdSet.has(r.parent_jira_issue_id)) {
      parentId = r.parent_jira_issue_id;
    } else if (r.parent_issue_key) {
      parentId = keyToJiraId.get(r.parent_issue_key) ?? null;
    }
    return { ...r, parent_id: parentId };
  });
}

/** 부모 → 자식 순 (동일 배치 내 FK 위반 방지) */
export function sortJiraTasksParentsFirst(rows: JiraTaskUpsertRow[]): JiraTaskUpsertRow[] {
  const byId = new Map(rows.map((r) => [r.jira_issue_id, r]));
  const depthMemo = new Map<string, number>();

  const depth = (id: string, visiting = new Set<string>()): number => {
    const cached = depthMemo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const row = byId.get(id);
    const pid = row?.parent_id;
    const d =
      pid && byId.has(pid) ? depth(pid, visiting) + 1 : 0;
    depthMemo.set(id, d);
    return d;
  };

  return [...rows].sort(
    (a, b) => depth(a.jira_issue_id) - depth(b.jira_issue_id)
  );
}

/** PostgREST upsert — DB 컬럼만 (parent_jira_issue_id 는 해석용, 테이블에 없음) */
export function toJiraTaskDbPayload(row: JiraTaskUpsertRow): JiraTaskDbRow {
  const { parent_jira_issue_id: _omit, ...db } = row;
  return db;
}

/** 1) parent_id=null 로 행 생성 · 2) parent_id 반영 (FK: jira_tasks_parent_id_fkey) */
async function upsertJiraTaskRowsTwoPhase(
  client: SupabaseClient,
  prepared: JiraTaskUpsertRow[],
  prefix: string
): Promise<number> {
  const chunkSize = 100;
  const withoutParent: JiraTaskDbRow[] = prepared.map((r) => ({
    ...toJiraTaskDbPayload(r),
    parent_id: null,
  }));

  const runChunks = async (payloads: JiraTaskDbRow[], label: string) => {
    for (let i = 0; i < payloads.length; i += chunkSize) {
      const dbChunk = payloads.slice(i, i + chunkSize);
      const chunkIndex = Math.floor(i / chunkSize);
      const { error } = await client.from("jira_tasks").upsert(dbChunk, {
        onConflict: JIRA_TASKS_UPSERT_ON_CONFLICT,
        ignoreDuplicates: false,
      });
      if (error) {
        const keys = dbChunk.slice(0, 5).map((r) => r.issue_key).join(", ");
        const more = dbChunk.length > 5 ? ` 외 ${dbChunk.length - 5}건` : "";
        logUpsertChunkError(prefix, chunkIndex, prepared.slice(i, i + chunkSize), error);
        throw new Error(
          formatJiraTasksDbError(
            `jira_tasks upsert 실패 (${label}) [${keys}${more}]`,
            error.message
          )
        );
      }
    }
  };

  await runChunks(withoutParent, "pass-1");
  await runChunks(
    prepared.map(toJiraTaskDbPayload),
    "pass-2"
  );
  return prepared.length;
}

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

/** JIRA API 응답에 없는 행 DELETE (고스트 데이터 수거) */
export async function pruneStaleJiraTasks(
  client: SupabaseClient,
  keepJiraIssueIds: Set<string>,
  logPrefix: string
): Promise<number> {
  if (keepJiraIssueIds.size === 0) {
    const { error, count } = await client
      .from("jira_tasks")
      .delete({ count: "exact" })
      .not("jira_issue_id", "is", null);
    if (error) throw new Error(`jira_tasks 전체 정리 실패: ${error.message}`);
    return count ?? 0;
  }

  const pageSize = 500;
  let offset = 0;
  let pruned = 0;

  for (;;) {
    const { data, error } = await client
      .from("jira_tasks")
      .select("jira_issue_id")
      .order("jira_issue_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`jira_tasks prune 스캔 실패: ${error.message}`);
    const rows = data ?? [];
    if (rows.length === 0) break;

    const staleIds = rows
      .map((r) => String(r.jira_issue_id ?? "").trim())
      .filter((id) => id && !keepJiraIssueIds.has(id));

    for (let i = 0; i < staleIds.length; i += 100) {
      const chunk = staleIds.slice(i, i + 100);
      const { error: delErr, count } = await client
        .from("jira_tasks")
        .delete({ count: "exact" })
        .in("jira_issue_id", chunk);
      if (delErr) throw new Error(`jira_tasks DELETE 실패: ${delErr.message}`);
      pruned += count ?? chunk.length;
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  if (pruned > 0) {
    console.info(`${logPrefix} pruned ${pruned} ghost row(s) (not in current JIRA fetch)`);
  }
  return pruned;
}

/**
 * jira_tasks 3방향 동기화
 * - INSERT/UPDATE: upsert onConflict jira_issue_id (issue_key·summary·status·assignee 덮어쓰기)
 * - DELETE: 현재 JIRA 페이로드에 없는 jira_issue_id 행 제거
 */
export async function upsertJiraTasksInDb(
  client: SupabaseClient,
  rows: JiraTaskDbRow[],
  options: UpsertOptions = {}
): Promise<UpsertJiraTasksResult> {
  const prefix = options.logPrefix ?? "[jira-tasks-upsert]";
  const pruneStale = options.pruneStale !== false;

  const snapshot = pruneStale ? await fetchJiraIssueKeySnapshot(client) : new Map<string, string>();
  const prepared = sortJiraTasksParentsFirst(prepareJiraTaskRowsForUpsert(rows));
  const keepIds = new Set(prepared.map((r) => r.jira_issue_id));

  if (prepared.length === 0) {
    const pruned = pruneStale ? await pruneStaleJiraTasks(client, keepIds, prefix) : 0;
    return { upserted: 0, pruned, keyMigrations: new Map() };
  }

  const upserted = await upsertJiraTaskRowsTwoPhase(client, prepared, prefix);

  const pruned = pruneStale ? await pruneStaleJiraTasks(client, keepIds, prefix) : 0;
  const keyMigrations = buildIssueKeyMigrationMap(snapshot, prepared);

  if (keyMigrations.size > 0) {
    console.info(
      `${prefix} issue_key migrations: ${[...keyMigrations.entries()]
        .map(([a, b]) => `${a}→${b}`)
        .join(", ")}`
    );
  }
  console.info(
    `${prefix} upserted ${upserted}, pruned ${pruned}, onConflict=${JIRA_TASKS_UPSERT_ON_CONFLICT}`
  );

  return { upserted, pruned, keyMigrations };
}

/** @deprecated replaceJiraTasksInDb → upsertJiraTasksInDb */
export async function replaceJiraTasksInDb(
  client: SupabaseClient,
  rows: JiraTaskDbRow[]
): Promise<number> {
  const { upserted } = await upsertJiraTasksInDb(client, rows);
  return upserted;
}
