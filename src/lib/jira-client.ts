import {
  getJiraApiTokenFromEnv,
  getJiraBaseUrlFromEnv,
  getJiraEmailFromEnv,
} from "@/lib/jira-env";
import { buildJiraClientHeaders } from "@/lib/jira-proxy-shared";

/** 개발: Vite JIRA 프록시 사용 가능 */
export function isJiraLiveFetchAvailable(): boolean {
  return Boolean(import.meta.env.DEV && getJiraBaseUrlFromEnv());
}

function jiraBasicAuthHeader(): string | null {
  const email = getJiraEmailFromEnv();
  const token = getJiraApiTokenFromEnv();
  if (!email || !token) return null;
  return `Basic ${btoa(`${email}:${token}`)}`;
}

/** 예: `/fass-dailyscrum/api/jira` — trailing slash 없음 */
export function getJiraProxyPrefix(): string | null {
  if (!isJiraLiveFetchAvailable()) return null;
  const base = import.meta.env.BASE_URL || "/";
  const withSlash = base.endsWith("/") ? base : `${base}/`;
  return `${withSlash}api/jira`;
}

/**
 * JIRA REST (개발: Vite 프록시 경유).
 * - credentials: omit (세션 쿠키 → XSRF 403 방지)
 * - X-Atlassian-Token: no-check (모든 메서드)
 */
export async function jiraFetch<T>(apiPath: string, init: RequestInit = {}): Promise<T> {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const method = (init.method ?? "GET").toUpperCase();

  let url: string;
  const mergedExtra = { ...(init.headers as Record<string, string> | undefined) };
  const headers = buildJiraClientHeaders({
    contentTypeJson: init.body != null,
    extra: mergedExtra,
  });

  const prefix = getJiraProxyPrefix();
  if (prefix) {
    url = `${prefix}${path}`;
  } else if (!import.meta.env.DEV && getJiraBaseUrlFromEnv()) {
    const auth = jiraBasicAuthHeader();
    if (!auth) {
      throw new Error("VITE_JIRA_EMAIL · VITE_JIRA_API_TOKEN 이 필요합니다.");
    }
    url = `${getJiraBaseUrlFromEnv().replace(/\/+$/, "")}${path}`;
    headers.Authorization = auth;
  } else {
    throw new Error("JIRA live fetch는 VITE_JIRA_BASE_URL 이 있을 때만 사용할 수 있습니다.");
  }

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
