/**
 * Supabase 스크럼·일지 테스트 데이터 전체 삭제 (JIRA 동기화 테이블은 유지)
 * 실행: npm run clear:test-data
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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
const url = (env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const key = (env.VITE_SUPABASE_ANON_KEY || "").trim();
const tlsInsecure =
  env.SUPABASE_TEST_TLS_INSECURE === "1" ||
  env.JIRA_TEST_TLS_INSECURE === "1" ||
  env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

if (tlsInsecure) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("⚠️  TLS 검증 비활성화 (사내 프록시/SSL 검사 테스트 전용)\n");
}

if (!url || !key) {
  console.error("❌ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 .env.local 에 필요합니다.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function deleteAll(table, label) {
  const { data, error: selErr } = await supabase.from(table).select("id");
  if (selErr) {
    if (/does not exist|Could not find/i.test(selErr.message)) {
      console.log(`⏭  ${label}: 테이블 없음 — 건너뜀`);
      return 0;
    }
    throw new Error(`${label} 조회 실패: ${selErr.message}`);
  }
  const ids = (data ?? []).map((r) => r.id).filter(Boolean);
  if (ids.length === 0) {
    console.log(`✓ ${label}: 0건 (이미 비어 있음)`);
    return 0;
  }
  const { error: delErr } = await supabase.from(table).delete().in("id", ids);
  if (delErr) throw new Error(`${label} 삭제 실패: ${delErr.message}`);
  console.log(`✓ ${label}: ${ids.length}건 삭제`);
  return ids.length;
}

async function deleteSmokeJiraSprints() {
  const { data, error } = await supabase.from("jira_sprints").select("id, sprint_name");
  if (error) {
    if (/does not exist|Could not find/i.test(error.message)) {
      console.log("⏭  jira_sprints 스모크: 테이블 없음 — 건너뜀");
      return 0;
    }
    throw new Error(`jira_sprints 조회 실패: ${error.message}`);
  }
  const smoke = (data ?? []).filter((row) => {
    const name = String(row.sprint_name ?? "");
    return (
      name.includes("[smoke-") ||
      /smoke/i.test(name) && name.length < 80
    );
  });
  if (smoke.length === 0) {
    console.log("✓ jira_sprints 스모크: 0건");
    return 0;
  }
  const ids = smoke.map((r) => r.id);
  const { error: delErr } = await supabase.from("jira_sprints").delete().in("id", ids);
  if (delErr) throw new Error(`jira_sprints 스모크 삭제 실패: ${delErr.message}`);
  console.log(`✓ jira_sprints 스모크: ${ids.length}건 삭제`);
  return ids.length;
}

async function run() {
  console.log(`\n🧹 테스트 데이터 삭제 — ${url}\n`);
  console.log("유지: jira_tasks, jira_dependencies, team_member_display_settings 등 JIRA 동기화·설정\n");

  let total = 0;
  total += await deleteAll("daily_reports", "daily_reports (팀 일지)");
  total += await deleteAll("scrum_entries", "scrum_entries (데일리 스크럼)");
  total += await deleteAll("scrum_member_sprints", "scrum_member_sprints (담당자 스프린트 등록)");
  total += await deleteSmokeJiraSprints();

  console.log(`\n✅ 완료 — 총 ${total}건 삭제\n`);
  console.log("브라우저 localStorage도 비우려면 앱을 연 뒤 개발자 도구 콘솔에서:");
  console.log('  ["scrum-daily-entries","scrum-member-registered-sprints","scrum_jira_exporter_snapshot"].forEach(k=>localStorage.removeItem(k)); location.reload()\n');
}

run().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
