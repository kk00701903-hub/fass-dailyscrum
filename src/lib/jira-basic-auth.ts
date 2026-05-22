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
  const parts = [
    "Atlassian 계정 이메일(VITE_JIRA_EMAIL)과 API 토큰이 동일 사용자 쌍인지 확인하세요.",
    "토큰은 https://id.atlassian.com/manage-profile/security/api-tokens 에서 새로 발급 후 .env.local 의 VITE_JIRA_API_TOKEN 에 붙여넣으세요.",
    "브라우저·Vite 프록시는 VITE_JIRA_* 만 읽습니다. process.env.JIRA_API_TOKEN 은 Node 스크립트·Supabase Edge 시크릿용입니다.",
  ];
  if (options?.devProxy) {
    parts.push("변경 후 npm run dev 를 재시작하세요.");
  }
  if (options?.edgeProxy) {
    parts.push("운영(GitHub Pages) 동기화는 Supabase Edge 시크릿 JIRA_EMAIL · JIRA_API_TOKEN 을 설정하세요.");
  }
  return parts.join(" ");
}
