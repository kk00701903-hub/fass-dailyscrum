/**
 * JIRA Cloud REST 자격 증명 검증 (단일 스모크).
 * @see scripts/jira-test-lib.mjs
 * @see tests/jira-api.integration.test.mjs
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, mergeProcessEnv, createJiraHttpClient, jiraGetMyself, isPlaceholderJiraBase } from "./jira-test-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const env = mergeProcessEnv(loadEnvLocal(root));
const client = createJiraHttpClient(env);

if (!client) {
  console.error("❌ .env.local 에 다음이 모두 필요합니다:");
  console.error("   VITE_JIRA_BASE_URL=https://your-site.atlassian.net");
  console.error("   VITE_JIRA_EMAIL=atlassian-계정-이메일");
  console.error("   VITE_JIRA_API_TOKEN=API_토큰_전체");
  process.exit(1);
}

if (isPlaceholderJiraBase(client.base)) {
  console.error("❌ VITE_JIRA_BASE_URL 이 예시 주소입니다 (your-org, example, localhost 등).");
  console.error("   실제 JIRA Cloud 사이트 URL(예: https://회사이름.atlassian.net)로 `.env.local` 을 수정한 뒤 다시 실행하세요.");
  process.exit(1);
}

if (client.tlsInsecure) {
  console.warn(
    "⚠️  JIRA_TEST_TLS_INSECURE=1: 이 스크립트의 JIRA HTTPS 요청에만 TLS 인증서 검증을 끕니다. 사내 테스트 전용입니다."
  );
}

let r;
try {
  r = await jiraGetMyself(client);
} catch (e) {
  const cause = e?.cause ?? e;
  console.error("❌ JIRA API 요청 실패 (네트워크/TLS)");
  console.error(`   ${cause?.message ?? String(e)}`);
  if (String(cause?.code || "").includes("CERT") || String(cause?.message || "").includes("certificate")) {
    console.error(
      "   (사내 SSL 복호화 환경이면 `.env.local` 에 `JIRA_TEST_TLS_INSECURE=1` 을 추가한 뒤 이 스크립트만 다시 실행해 보세요.)"
    );
  }
  process.exit(1);
}

if (!r.ok) {
  console.error(`❌ JIRA API 실패 HTTP ${r.status}`);
  console.error(typeof r.json === "object" ? JSON.stringify(r.json, null, 2) : r.text?.slice(0, 800));
  const err = r.json && typeof r.json === "object" ? r.json : {};
  if (err.errorMessage === "Site temporarily unavailable" || err.errorCode === "OTHER") {
    console.error(
      "   → Atlassian 이 이 호스트에서 JIRA를 제공하지 않는 경우가 많습니다. VITE_JIRA_BASE_URL 이 맞는지 확인하세요."
    );
  }
  process.exit(1);
}

const body = r.json;
console.log("✅ JIRA Cloud REST 연결 성공");
console.log(`   사용자: ${body.displayName ?? body.emailAddress ?? "(이름 없음)"}`);
console.log(`   계정: ${body.emailAddress ?? client.email}`);
console.log(`   accountId: ${body.accountId ?? "—"}`);
console.log(`   엔드포인트: ${client.base}/rest/api/3/myself`);
