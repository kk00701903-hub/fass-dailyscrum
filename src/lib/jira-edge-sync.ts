import { jiraAuthFailureHint } from "@/lib/jira-basic-auth";
import { supabase } from "@/lib/supabaseClient";

export type JiraEdgeSyncResult = {
  ok: boolean;
  count?: number;
  tasksCount?: number;
  pruned?: number;
  keyMigrations?: Map<string, string>;
  error?: string;
};

type EdgePayload = {
  ok?: boolean;
  error?: string;
  count?: number;
  tasksCount?: number;
  sprintsCount?: number;
  pruned?: number;
  keyMigrations?: Record<string, string>;
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

function invokeResponse(error: unknown): Response | undefined {
  if (error && typeof error === "object" && "context" in error) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === "function") return ctx as Response;
  }
  return undefined;
}

async function readEdgeErrorDetail(error: unknown): Promise<string | null> {
  const res = invokeResponse(error);
  if (!res) return null;
  try {
    const body = await res.clone().json();
    if (typeof body === "object" && body !== null && "error" in body) {
      return String((body as { error: unknown }).error);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function formatEdgeInvokeError(base: string, detail: string | null): string {
  const msg = detail && !base.includes(detail) ? detail : base;
  if (/JIRA HTTP 401|authenticated to access/i.test(msg)) {
    return `${msg} — ${jiraAuthFailureHint({ edgeProxy: true })}`;
  }
  if (/failed to send a request/i.test(msg)) {
    return (
      `${msg} — Edge Function 네트워크·배포를 확인하세요. ` +
      "Supabase Dashboard에서 sync-jira-all · jira-proxy 배포 여부, " +
      "또는 GitHub Actions「Deploy Supabase Edge」를 실행하세요."
    );
  }
  return msg;
}

export function isEdgeUnavailable(msg: string): boolean {
  return /failed to send|not found|404|non-2xx|function not found/i.test(msg);
}

export function isJiraEdgeAuthFailure(msg: string): boolean {
  return /JIRA HTTP 401|authenticated to access|Client must be authenticated/i.test(msg);
}

/** Supabase Edge Function 호출 (수동 동기화 · GitHub Pages) */
export async function invokeJiraEdgeSync(functionName: string): Promise<JiraEdgeSyncResult> {
  const { data, error } = await supabase.functions.invoke(functionName, { body: {} });
  const payload = parsePayload(data);

  if (error) {
    const base = error.message || String(error);
    const detail = await readEdgeErrorDetail(error);
    const msg = formatEdgeInvokeError(base, detail);
    return { ok: false, error: msg };
  }

  if (payload?.error) {
    const msg = formatEdgeInvokeError(String(payload.error), null);
    return {
      ok: false,
      error: msg,
      count: payload.count ?? payload.sprintsCount,
      tasksCount: payload.tasksCount,
    };
  }

  const count = payload?.count ?? payload?.sprintsCount;
  const keyMigrations = new Map<string, string>();
  if (payload?.keyMigrations && typeof payload.keyMigrations === "object") {
    for (const [oldKey, newKey] of Object.entries(payload.keyMigrations)) {
      if (oldKey && newKey) keyMigrations.set(oldKey, String(newKey));
    }
  }
  return {
    ok: payload?.ok !== false,
    count: typeof count === "number" ? count : undefined,
    tasksCount: typeof payload?.tasksCount === "number" ? payload.tasksCount : undefined,
    pruned: typeof payload?.pruned === "number" ? payload.pruned : undefined,
    keyMigrations,
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
      const retryable =
        isEdgeUnavailable(result.error ?? "") || isJiraEdgeAuthFailure(result.error ?? "");
      if (!retryable) return result;
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

  const retryable =
    isEdgeUnavailable(sprintsOnly.error ?? "") || isJiraEdgeAuthFailure(sprintsOnly.error ?? "");
  if (!retryable) return sprintsOnly;
  return { ok: false, error: lastError ?? sprintsOnly.error ?? "Edge Function not found" };
}
