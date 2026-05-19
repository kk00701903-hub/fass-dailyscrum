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

/** sync-jira-all → sync-jira-sprints 순으로 시도 */
export async function invokeProductionJiraSync(): Promise<JiraEdgeSyncResult> {
  for (const name of ["sync-jira-all", "sync-jira-sprints"] as const) {
    const result = await invokeJiraEdgeSync(name);
    if (result.ok) return result;
    if (!isEdgeUnavailable(result.error ?? "")) return result;
  }
  return { ok: false, error: "Edge Function not found" };
}
