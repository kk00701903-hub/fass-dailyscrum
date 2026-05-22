/**
 * .env.local 의 JIRA 값 → Supabase Edge Function Secrets (Vault 아님)
 *
 * 사전 준비:
 *   1. https://supabase.com/dashboard/account/tokens → sbp_ 토큰 발급
 *   2. 환경 변수: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF=cvnyayoddcxhigjtyuqb
 *
 * 실행: npm run secrets:push-jira
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const p = resolve(root, ".env.local");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const projectRef =
  env.SUPABASE_PROJECT_REF || env.VITE_SUPABASE_PROJECT_REF || "cvnyayoddcxhigjtyuqb";
const accessToken = (env.SUPABASE_ACCESS_TOKEN || "").trim();

const jiraBase = (env.JIRA_BASE_URL || env.VITE_JIRA_BASE_URL || "").trim().replace(/\/+$/, "");
const jiraEmail = (env.JIRA_EMAIL || env.VITE_JIRA_EMAIL || "").trim();
const jiraToken = (env.JIRA_API_TOKEN || env.VITE_JIRA_API_TOKEN || "").trim();
const boardId = (env.JIRA_BOARD_ID || env.VITE_JIRA_BOARD_ID || "").trim();
const projectKey = (env.JIRA_PROJECT_KEY || env.VITE_JIRA_PROJECT_KEY || "").trim();
const storyField = (env.JIRA_STORY_POINTS_FIELD || env.VITE_JIRA_STORY_POINTS_FIELD || "").trim();

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!accessToken) {
  fail(
    "SUPABASE_ACCESS_TOKEN 없음.\n" +
      "   Dashboard → Account → Access Tokens (sbp_...) 발급 후:\n" +
      "   $env:SUPABASE_ACCESS_TOKEN='sbp_...'  (PowerShell)\n" +
      "   npm run secrets:push-jira"
  );
}
if (!accessToken.startsWith("sbp_")) {
  fail("SUPABASE_ACCESS_TOKEN 은 sbp_ 로 시작해야 합니다 (Vault 토큰·anon 키 아님).");
}
if (!jiraBase || !jiraEmail || !jiraToken || !boardId) {
  fail(
    ".env.local 에 VITE_JIRA_BASE_URL, VITE_JIRA_EMAIL, VITE_JIRA_API_TOKEN, VITE_JIRA_BOARD_ID 가 필요합니다."
  );
}

const args = [
  "secrets",
  "set",
  "--project-ref",
  projectRef,
  `JIRA_BASE_URL=${jiraBase}`,
  `JIRA_EMAIL=${jiraEmail}`,
  `JIRA_API_TOKEN=${jiraToken}`,
  `JIRA_BOARD_ID=${boardId}`,
];
if (projectKey) args.push(`JIRA_PROJECT_KEY=${projectKey}`);
if (storyField) args.push(`JIRA_STORY_POINTS_FIELD=${storyField}`);

console.log(`\n→ Edge Secrets 설정 (project: ${projectRef})`);
console.log(`   JIRA_BASE_URL=${jiraBase}`);
console.log(`   JIRA_EMAIL=${jiraEmail}`);
console.log(`   JIRA_API_TOKEN=*** (${jiraToken.length} chars)`);
console.log(`   JIRA_BOARD_ID=${boardId}`);
if (projectKey) console.log(`   JIRA_PROJECT_KEY=${projectKey}`);
console.log("\n⚠️  Vault 가 아니라 Edge Function Secrets 입니다.\n");

const login = spawnSync("npx", ["supabase", "login", "--token", accessToken], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
});
if (login.status !== 0) fail("supabase login 실패");

const set = spawnSync("npx", ["supabase", ...args], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
});
if (set.status !== 0) fail("supabase secrets set 실패");

console.log("\n✅ Edge Secrets 반영됨. 검증: npm run test:edge-invoke\n");
