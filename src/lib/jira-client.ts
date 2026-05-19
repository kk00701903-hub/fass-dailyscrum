import { getJiraBaseUrlFromEnv } from "@/lib/jira-env";
import { buildJiraClientHeaders } from "@/lib/jira-proxy-shared";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** 개발: Vite JIRA 프록시 사용 가능 */
export function isJiraLiveFetchAvailable(): boolean {
  return Boolean(import.meta.env.DEV && getJiraBaseUrlFromEnv());
}

/** 예: `/fass-dailyscrum/api/jira` — trailing slash 없음 */
export function getJiraProxyPrefix(): string | null {
  if (!isJiraLiveFetchAvailable()) return null;
  const base = import.meta.env.BASE_URL || "/";
  const withSlash = base.endsWith("/") ? base : `${base}/`;
  return `${withSlash}api/jira`;
}

async function jiraFetchViaEdgeProxy<T>(apiPath: string, init: RequestInit = {}): Promise<T> {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const method = (init.method ?? "GET").toUpperCase();
  const body =
    init.body != null ? (typeof init.body === "string" ? init.body : JSON.stringify(init.body)) : undefined;

  const { data, error } = await supabase.functions.invoke("jira-proxy", {
    body: { path, method, body },
  });

  if (error) {
    const msg = error.message || String(error);
    if (/not found|404|non-2xx/i.test(msg)) {
      throw new Error(
        `${msg} — Supabase Edge Function jira-proxy 배포 필요 (GitHub Actions deploy-supabase-edge 또는 npx supabase functions deploy jira-proxy)`
      );
    }
    throw new Error(msg);
  }

  const payload = data as { ok?: boolean; error?: string; data?: T } | null;
  if (payload?.error) throw new Error(payload.error);
  if (payload?.data === undefined) {
    throw new Error("jira-proxy 응답이 비어 있습니다.");
  }
  return payload.data;
}

/**
 * JIRA REST
 * - 개발: Vite 프록시
 * - 운영(GitHub Pages): Supabase Edge jira-proxy (CORS·토큰 서버 보관)
 */
export async function jiraFetch<T>(apiPath: string, init: RequestInit = {}): Promise<T> {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const method = (init.method ?? "GET").toUpperCase();

  if (!import.meta.env.DEV && isSupabaseConfigured()) {
    return jiraFetchViaEdgeProxy<T>(path, init);
  }

  const prefix = getJiraProxyPrefix();
  if (!prefix) {
    throw new Error("JIRA live fetch는 개발 모드(Vite 프록시) 또는 Supabase jira-proxy 가 필요합니다.");
  }

  const url = `${prefix}${path}`;
  const mergedExtra = { ...(init.headers as Record<string, string> | undefined) };
  const headers = buildJiraClientHeaders({
    contentTypeJson: init.body != null,
    extra: mergedExtra,
  });

  const res = await fetch(url, {
    ...init,
    method,
    headers,
    credentials: "omit",
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 400) };
  }

  if (!res.ok) {
    const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    const parts: string[] = [];
    if (b?.errorMessages && Array.isArray(b.errorMessages)) {
      parts.push(...b.errorMessages.map(String));
    } else if (b?.message) {
      parts.push(String(b.message));
    }
    if (b?.proxyHint) parts.push(String(b.proxyHint));
    if (b?.raw && typeof b.raw === "string") parts.push(b.raw);
    if (!parts.length && text.trim()) parts.push(text.trim().slice(0, 400));

    if (!parts.length && res.status >= 500) {
      parts.push(
        "개발 서버 JIRA 프록시 오류. .env.local 에 JIRA_PROXY_TLS_INSECURE=1 후 npm run dev 재시작(사내 SSL 검사 환경)"
      );
    }
    if (res.status === 403 && parts.some((p) => /xsrf/i.test(p))) {
      parts.push("npm run dev 재시작 후에도 동일하면 Vite 프록시·jira-client 최신 코드인지 확인");
    }

    const msg = parts.length ? parts.join(" · ") : "알 수 없는 오류";
    throw new Error(`JIRA HTTP ${res.status}: ${msg}`);
  }

  return body as T;
}

export function getJiraBrowseIssueUrl(issueKey: string): string | null {
  const site = getJiraBaseUrlFromEnv().replace(/\/+$/, "");
  if (!site) return null;
  return `${site}/browse/${encodeURIComponent(issueKey)}`;
}
