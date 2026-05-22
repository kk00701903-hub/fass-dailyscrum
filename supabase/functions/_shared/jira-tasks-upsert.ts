import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const JIRA_TASKS_UPSERT_ON_CONFLICT = "jira_issue_id";

export type JiraTaskUpsertRow = Record<string, unknown> & {
  id: string;
  jira_issue_id: string;
  issue_key: string;
  parent_jira_issue_id?: string | null;
};

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
    if (error) throw new Error(`jira_tasks snapshot: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      const id = String(row.jira_issue_id ?? "").trim();
      if (id) map.set(id, String(row.issue_key ?? "").trim());
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return map;
}

export function buildIssueKeyMigrationMap(
  before: Map<string, string>,
  rows: Iterable<JiraTaskUpsertRow>
): Map<string, string> {
  const migrations = new Map<string, string>();
  for (const row of rows) {
    const id = row.jira_issue_id;
    const newKey = String(row.issue_key ?? "").trim();
    const oldKey = before.get(id);
    if (oldKey && newKey && oldKey !== newKey) migrations.set(oldKey, newKey);
  }
  return migrations;
}

export function prepareJiraTaskRowsForUpsert(
  rows: Array<Record<string, unknown>>
): JiraTaskUpsertRow[] {
  const normalized: JiraTaskUpsertRow[] = rows.map((r) => {
    const jiraIssueId = String(r.jira_issue_id ?? r.id ?? "").trim();
    return {
      ...r,
      id: jiraIssueId,
      jira_issue_id: jiraIssueId,
      issue_key: String(r.issue_key ?? "").trim(),
      summary: String(r.summary ?? "—").trim() || "—",
      jira_status_name: String(r.jira_status_name ?? ""),
      parent_jira_issue_id: r.parent_jira_issue_id
        ? String(r.parent_jira_issue_id).trim()
        : null,
    } as JiraTaskUpsertRow;
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
      parentId = keyToJiraId.get(String(r.parent_issue_key)) ?? null;
    }
    return { ...r, parent_id: parentId };
  });
}

function sortJiraTasksParentsFirst(rows: JiraTaskUpsertRow[]): JiraTaskUpsertRow[] {
  const byId = new Map(rows.map((r) => [r.jira_issue_id, r]));
  const depthMemo = new Map<string, number>();

  const depth = (id: string, visiting = new Set<string>()): number => {
    const cached = depthMemo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const row = byId.get(id);
    const pid = row?.parent_id as string | null | undefined;
    const d = pid && byId.has(pid) ? depth(pid, visiting) + 1 : 0;
    depthMemo.set(id, d);
    return d;
  };

  return [...rows].sort(
    (a, b) => depth(a.jira_issue_id) - depth(b.jira_issue_id)
  );
}

function toJiraTaskDbPayload(row: JiraTaskUpsertRow): Record<string, unknown> {
  const { parent_jira_issue_id: _omit, ...db } = row;
  return db;
}

async function pruneStaleJiraTasks(
  client: SupabaseClient,
  keepJiraIssueIds: Set<string>,
  logPrefix: string
): Promise<number> {
  if (keepJiraIssueIds.size === 0) {
    const { error, count } = await client
      .from("jira_tasks")
      .delete({ count: "exact" })
      .not("jira_issue_id", "is", null);
    if (error) throw new Error(`jira_tasks clear failed: ${error.message}`);
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
    if (error) throw new Error(`jira_tasks prune scan: ${error.message}`);
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
      if (delErr) throw new Error(`jira_tasks prune delete: ${delErr.message}`);
      pruned += count ?? chunk.length;
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  if (pruned > 0) console.info(`${logPrefix} pruned ${pruned} ghost row(s)`);
  return pruned;
}

export async function upsertJiraTasksInDb(
  client: SupabaseClient,
  rows: Array<Record<string, unknown>>,
  options: { pruneStale?: boolean; logPrefix?: string } = {}
): Promise<{ upserted: number; pruned: number; keyMigrations: Map<string, string> }> {
  const prefix = options.logPrefix ?? "[jira-tasks-upsert]";
  const pruneStale = options.pruneStale !== false;
  const snapshot = pruneStale ? await fetchJiraIssueKeySnapshot(client) : new Map();
  const prepared = sortJiraTasksParentsFirst(prepareJiraTaskRowsForUpsert(rows));
  const keepIds = new Set(prepared.map((r) => r.jira_issue_id));

  if (prepared.length === 0) {
    const pruned = pruneStale ? await pruneStaleJiraTasks(client, keepIds, prefix) : 0;
    return { upserted: 0, pruned, keyMigrations: new Map() };
  }

  const chunkSize = 100;
  const withoutParent = prepared.map((r) => ({
    ...toJiraTaskDbPayload(r),
    parent_id: null,
  }));

  const runChunks = async (payloads: Record<string, unknown>[], label: string) => {
    for (let i = 0; i < payloads.length; i += chunkSize) {
      const dbChunk = payloads.slice(i, i + chunkSize);
      const { error } = await client.from("jira_tasks").upsert(dbChunk, {
        onConflict: JIRA_TASKS_UPSERT_ON_CONFLICT,
        ignoreDuplicates: false,
      });
      if (error) {
        const keys = dbChunk
          .slice(0, 5)
          .map((r) => r.issue_key)
          .join(", ");
        throw new Error(
          `jira_tasks upsert failed (${label}) [${keys}]: ${error.message}`
        );
      }
    }
  };

  await runChunks(withoutParent, "pass-1");
  await runChunks(
    prepared.map(toJiraTaskDbPayload),
    "pass-2"
  );
  const upserted = prepared.length;

  const pruned = pruneStale ? await pruneStaleJiraTasks(client, keepIds, prefix) : 0;
  const keyMigrations = buildIssueKeyMigrationMap(snapshot, prepared);
  console.info(`${prefix} upserted ${upserted}, pruned ${pruned}`);
  return { upserted, pruned, keyMigrations };
}
