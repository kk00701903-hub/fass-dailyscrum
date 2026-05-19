/**
 * JIRA 동기화 구성 점검 (로컬)
 * npm run verify:jira-sync
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
let failed = 0;

function pass(msg) {
  console.log(`✅ ${msg}`);
}
function fail(msg) {
  failed++;
  console.error(`❌ ${msg}`);
}
function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

console.log("\n── 1. GitHub Actions 워크플로 ──\n");
const wfPath = resolve(root, ".github/workflows/jira-sync.yml");
if (!existsSync(wfPath)) {
  fail("jira-sync.yml 없음");
} else {
  const wf = readFileSync(wfPath, "utf8");
  if (/cron:\s*["']0 0 \* \* \*["']/.test(wf)) pass("cron 0 0 * * * (UTC 00:00 = KST 09:00)");
  else fail("cron 스케줄 확인 필요");

  if (/sync:jira:all/.test(wf)) pass("배치 명령: npm run sync:jira:all (스프린트+이슈)");
  else if (/sync:jira/.test(wf)) warn("배치가 sync:jira 만 실행 — jira_tasks 미포함 가능");
  else fail("sync:jira 스크립트 없음");

  if (/workflow_dispatch/.test(wf)) pass("workflow_dispatch (수동 실행) 지원");
  else warn("workflow_dispatch 없음");

  const secrets = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JIRA_BASE_URL",
    "JIRA_EMAIL",
    "JIRA_API_TOKEN",
    "JIRA_BOARD_ID",
  ];
  for (const s of secrets) {
    if (wf.includes(s)) pass(`워크플로 시크릿 참조: ${s}`);
  }
}

console.log("\n── 2. 프론트 실시간(Realtime) ──\n");
const dashSrc = readFileSync(resolve(root, "src/lib/jira-sprints-dashboard.ts"), "utf8");
if (/table:\s*["']jira_sprints["']/.test(dashSrc) && /table:\s*["']jira_tasks["']/.test(dashSrc)) {
  pass("subscribe: jira_sprints + jira_tasks Realtime 구독");
} else {
  fail("Realtime 구독에 jira_tasks 미포함");
}

const layoutSrc = readFileSync(resolve(root, "src/components/Layout.tsx"), "utf8");
if (/useJiraDailyScheduleSync/.test(layoutSrc)) pass("Layout: 브라우저 09:00 보조 스케줄 연결");
else fail("useJiraDailyScheduleSync 미연결");

console.log("\n── 3. Supabase DB 최신 반영 (로컬 .env.local) ──\n");
const url = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
if (!url || !key) {
  warn("VITE_SUPABASE_* 없음 — DB 점검 생략");
} else {
  if (env.JIRA_TEST_TLS_INSECURE === "1") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const supabase = createClient(url, key);

  const { data: sprints, error: se } = await supabase
    .from("jira_sprints")
    .select("sprint_name, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (se) fail(`jira_sprints: ${se.message}`);
  else if (sprints?.[0]) {
    pass(`jira_sprints 최신: ${sprints[0].sprint_name} @ ${sprints[0].updated_at}`);
  } else warn("jira_sprints 비어 있음 — sync:jira 실행 필요");

  const { data: tasks, error: te } = await supabase
    .from("jira_tasks")
    .select("issue_key, updated_at, is_subtask")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (te) fail(`jira_tasks: ${te.message}`);
  else if (tasks?.[0]) {
    pass(`jira_tasks 최신: ${tasks[0].issue_key} @ ${tasks[0].updated_at}`);
  } else warn("jira_tasks 비어 있음 — sync:jira:tasks 실행 필요");
}

console.log("\n── 4. GitHub Actions 실행 이력 (수동 확인) ──\n");
console.log("   Repo → Actions → 'JIRA Sync (Sprints + Tasks)' → 최근 Run 성공 여부");
console.log("   또는: gh run list --workflow=jira-sync.yml\n");

if (failed > 0) {
  console.error(`\n실패 ${failed}건\n`);
  process.exit(1);
}
console.log("\n✅ 로컬 구성 점검 통과 (Actions Run은 GitHub에서 확인)\n");
