/**
 * JIRA Cloud REST — 브라우저(fetch) · Vite dev 프록시(Node) 공통 헤더·상수.
 * 사내 SSL: vite.config.ts 의 JIRA_PROXY_TLS_INSECURE (rejectUnauthorized: false)
 * XSRF: 모든 요청에 X-Atlassian-Token: no-check
 */

export const JIRA_XSRF_HEADER = "X-Atlassian-Token";
export const JIRA_XSRF_VALUE = "no-check";

/** 브라우저 → Vite 프록시 fetch 용 기본 헤더 (항상 XSRF 토큰 포함) */
export function buildJiraClientHeaders(options?: {
  contentTypeJson?: boolean;
  extra?: Record<string, string>;
}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    [JIRA_XSRF_HEADER]: JIRA_XSRF_VALUE,
  };
  if (options?.contentTypeJson) {
    headers["Content-Type"] = "application/json";
  }
  if (options?.extra) {
    Object.assign(headers, options.extra);
  }
  return headers;
}

/** http-proxy proxyReq — 브라우저 Origin/Cookie 제거 + Basic + XSRF */
export function applyJiraProxyRequestHeaders(
  proxyReq: { removeHeader: (name: string) => void; setHeader: (name: string, value: string) => void; getHeader?: (name: string) => string | number | string[] | undefined; method?: string },
  basicAuthBase64: string
): void {
  proxyReq.removeHeader("cookie");
  proxyReq.removeHeader("origin");
  proxyReq.removeHeader("referer");
  proxyReq.setHeader("Authorization", `Basic ${basicAuthBase64}`);
  proxyReq.setHeader(JIRA_XSRF_HEADER, JIRA_XSRF_VALUE);
  if (!proxyReq.getHeader?.("Accept")) {
    proxyReq.setHeader("Accept", "application/json");
  }
}

export function isJiraProxyTlsInsecureFromEnv(env: Record<string, string>): boolean {
  return env.JIRA_PROXY_TLS_INSECURE === "1" || env.JIRA_TEST_TLS_INSECURE === "1";
}
