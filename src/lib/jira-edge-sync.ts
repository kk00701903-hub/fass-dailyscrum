import { supabase } from "@/lib/supabaseClient";

export type JiraEdgeSyncResult = {
  ok: boolean;
  count?: number;
  tasksCount?: number;
  error?: string;
};

type EdgePayload = {
  ok?: boolean;
  error?: string;
  count?: number;
  tasksCount?: number;
  sprintsCount?: number;
};

function parsePayload(data: unknown): EdgePayload | null {
  if (data == null) return null;
  if (typeof data === "object") return data as EdgePayload;
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as EdgePayload;
    } catch {
      return { error: data };
    }
  }
  return null;
}

function isEdgeUnavailable(msg: string): boolean {
  return /failed to send|not found|404|non-2xx|function not found/i.test(msg);
}

/** Supabase Edge Function 호출 (수동 동기화 · GitHub Pages) */
export async function invokeJiraEdgeSync(functionName: string): Promise<JiraEdgeSyncResult> {
  const { data, error } = await supabase.functions.invoke(functionName, { body: {} });
  const payload = parsePayload(data);

  if (error) {
    const msg = error.message || String(error);
    if (isEdgeUnavailable(msg)) {
      return { ok: false, error: msg };
    }
    return { ok: false, error: msg };
  }

  if (payload?.error) {
    return {
      ok: false,
      error: payload.error,
      count: payload.count ?? payload.sprintsCount,
      tasksCount: payload.tasksCount,
    };
  }

  const count = payload?.count ?? payload?.sprintsCount;
  return {
    ok: payload?.ok !== false,
    count: typeof count === "number" ? count : undefined,
    tasksCount: typeof payload?.tasksCount === "number" ? payload.tasksCount : undefined,
  };
}

function hasSyncedTasks(result: JiraEdgeSyncResult): boolean {
  return result.ok && (result.tasksCount ?? 0) > 0;
}

/**
 * 이슈(FWK) 포함 전체 동기화 우선.
 * sync-jira-sprints 는 스프린트만 갱신하므로, 이슈 동기화 성공 전에는 최종 성공으로 쓰지 않음.
 */
export async function invokeProductionJiraSync(): Promise<JiraEdgeSyncResult> {
  const taskSyncFns = ["sync-jira-all", "jira-sync"] as const;
  let lastError: string | undefined;

  for (const name of taskSyncFns) {
    const result = await invokeJiraEdgeSync(name);
    if (hasSyncedTasks(result)) return result;
    if (result.ok && (result.tasksCount ?? 0) === 0) {
      lastError = `${name}: 이슈 0건 — jira_tasks 미갱신`;
    } else if (!result.ok) {
      lastError = result.error;
      if (!isEdgeUnavailable(result.error ?? "")) return result;
    }
  }

  const sprintsOnly = await invokeJiraEdgeSync("sync-jira-sprints");
  if (sprintsOnly.ok) {
    return {
      ok: false,
      count: sprintsOnly.count,
      tasksCount: 0,
      error:
        lastError ??
        "스프린트만 동기화되었습니다. FWK 이슈 반영을 위해 sync-jira-all Edge 배포 또는 npm run sync:jira:all 을 실행하세요.",
    };
  }

  if (!isEdgeUnavailable(sprintsOnly.error ?? "")) return sprintsOnly;
  return { ok: false, error: lastError ?? sprintsOnly.error ?? "Edge Function not found" };
}
