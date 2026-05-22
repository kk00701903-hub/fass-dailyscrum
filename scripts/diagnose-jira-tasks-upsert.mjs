/**
 * jira_tasks upsert 실패 원인 진단 (토큰·값 출력 최소화)
 * node scripts/diagnose-jira-tasks-upsert.mjs
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
if (env.JIRA_TEST_TLS_INSECURE === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const url = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
if (!url || !key) {
  console.error("VITE_SUPABASE_* 필요");
  process.exit(1);
}

const supabase = createClient(url, key);

const probeId = "debug-probe-" + Date.now();
const rowWithExtra = {
  id: probeId,
  jira_issue_id: probeId,
  issue_key: "PROBE-KEY",
  sprint_id: "",
  summary: "probe",
  status: "TODO",
  priority: "MEDIUM",
  assignee_id: "jira-unassigned",
  assignee_name: "미배정",
  assignee_role: "—",
  assignee_color: "#64748b",
  story_points: 0,
  updated_at: new Date().toISOString(),
  labels: [],
  synced_at: new Date().toISOString(),
  assignee_account_id: null,
  assignee_email: null,
  due_date: null,
  start_date: null,
  created_at: null,
  resolved_at: null,
  issue_type: "",
  parent_issue_key: null,
  parent_id: null,
  is_subtask: false,
  jira_status_name: "",
  parent_jira_issue_id: "99999",
};

console.log("\n── 1) jira_issue_id 컬럼 ──");
const { error: colErr } = await supabase
  .from("jira_tasks")
  .select("jira_issue_id")
  .limit(1);
console.log(colErr ? `FAIL: ${colErr.message} (${colErr.code})` : "OK");

console.log("\n── 2) upsert with parent_jira_issue_id (앱과 동일) ──");
const { error: badErr } = await supabase.from("jira_tasks").upsert([rowWithExtra], {
  onConflict: "jira_issue_id",
  ignoreDuplicates: false,
});
console.log(badErr ? `FAIL: ${badErr.message} (${badErr.code})` : "OK");

const rowClean = { ...rowWithExtra };
delete rowClean.parent_jira_issue_id;

console.log("\n── 3) upsert without parent_jira_issue_id ──");
const { error: goodErr } = await supabase.from("jira_tasks").upsert([rowClean], {
  onConflict: "jira_issue_id",
  ignoreDuplicates: false,
});
console.log(goodErr ? `FAIL: ${goodErr.message} (${goodErr.code})` : "OK");

if (!goodErr) {
  await supabase.from("jira_tasks").delete().eq("jira_issue_id", probeId);
  console.log("   (probe row deleted)");
}

console.log("\n── 4) onConflict 없는 unique (추정) ──");
if (badErr?.message?.includes("unique") || badErr?.message?.includes("ON CONFLICT")) {
  console.log("   → issue_key 유니크 또는 jira_issue_id 인덱스 확인: apply-jira-issue-id-migration.sql");
}
if (badErr?.code === "PGRST204" || /parent_jira_issue_id|schema cache/i.test(badErr?.message ?? "")) {
  console.log("   → CONFIRMED: parent_jira_issue_id 컬럼 없음 — 코드 수정 필요");
}

process.exit(badErr && !goodErr ? 1 : 0);
