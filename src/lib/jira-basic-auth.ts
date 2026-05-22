/**
 * JIRA Cloud REST Basic 인증 — email:api_token → Base64
 * @see https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/
 */

/** .env 값의 따옴표·공백 제거 */
export function normalizeJiraCredential(value: string | undefined | null): string {
  let v = (value ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** UTF-8 안전 Base64 (브라우저 · Node · Deno 공용 패턴) */
export function buildJiraBasicAuthBase64(email: string, apiToken: string): string {
  const e = normalizeJiraCredential(email);
  const t = normalizeJiraCredential(apiToken);
  if (!e || !t) {
    throw new Error("JIRA 이메일과 API 토큰이 필요합니다.");
  }
  const credentials = `${e}:${t}`;

  if (typeof Buffer !== "undefined") {
    return Buffer.from(credentials, "utf8").toString("base64");
  }

  const bytes = new TextEncoder().encode(credentials);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function buildJiraAuthorizationHeader(email: string, apiToken: string): string {
  return `Basic ${buildJiraBasicAuthBase64(email, apiToken)}`;
}

/** 401 시 사용자 안내 (토큰 값은 노출하지 않음) */
export function jiraAuthFailureHint(options?: {
  devProxy?: boolean;
  edgeProxy?: boolean;
}): string {
  const parts: string[] = [];
  if (options?.edgeProxy ?? !options?.devProxy) {
    parts.push(
      "Supabase Edge Secrets: JIRA_EMAIL · JIRA_API_TOKEN (팀 서비스 계정, 만료 최대 365일). 갱신 시 GitHub Actions secrets 도 동일 값으로 맞추세요."
    );
    parts.push("자세한 절차: docs/JIRA_AUTH.md");
  }
  if (options?.devProxy) {
    parts.push(
      "로컬 Vite 프록시 디버그 시에만 .env.local 의 VITE_JIRA_EMAIL · VITE_JIRA_API_TOKEN 을 확인하세요 (선택)."
    );
    parts.push("변경 후 npm run dev 를 재시작하세요.");
  }
  return parts.join(" ");
}
