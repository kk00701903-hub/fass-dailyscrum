/**
 * 애널리틱스 팀원별 기여도 숫자 검증
 * node scripts/verify-analytics-member.mjs [memberId]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const memberId = process.argv[2] ?? "song";

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
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY required");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: sprints } = await supabase
  .from("jira_sprints")
  .select("id, sprint_name, status, jira_sprint_id")
  .order("updated_at", { ascending: false });

const activeSprint =
  (sprints ?? []).find((s) => String(s.status).toLowerCase() === "active") ?? sprints?.[0] ?? null;

const { data: tasks, error } = await supabase
  .from("jira_tasks")
  .select("issue_key, summary, status, sprint_id, assignee_id, assignee_name, story_points, is_subtask")
  .eq("assignee_id", memberId)
  .order("issue_key");

if (error) {
  console.error(error.message);
  process.exit(1);
}

const all = tasks ?? [];
const done = all.filter((t) => t.status === "DONE");
const byStatus = {};
for (const t of all) {
  byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
}

const activeId = activeSprint?.id ?? null;
const inActiveSprint = activeId ? all.filter((t) => t.sprint_id === activeId) : [];
const doneActive = inActiveSprint.filter((t) => t.status === "DONE");

const sprintNameById = Object.fromEntries((sprints ?? []).map((s) => [s.id, s.sprint_name]));

console.log(`\n=== Analytics 기여도 검증 (assignee_id=${memberId}) ===\n`);
console.log(`앱 계산 방식: getActiveJiraTasks() 전체 중 assignee.id === "${memberId}"`);
console.log(`  → 완료 = status === "DONE" 개수`);
console.log(`  → 전체 = 담당 이슈 개수 (스프린트 필터 없음)\n`);

console.log(`DB 담당 이슈: ${all.length}건`);
console.log(`  완료(DONE): ${done.length}건`);
console.log(`  완료율: ${all.length ? Math.round((done.length / all.length) * 100) : 0}%`);
console.log(`\n상태별:`);
for (const [st, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${st}: ${n}`);
}

if (activeSprint) {
  console.log(`\n활성 스프린트만 (${activeSprint.sprint_name}, id=${activeId}):`);
  console.log(`  담당 ${inActiveSprint.length}건, 완료 ${doneActive.length}건`);
}

console.log(`\n스프린트별 담당 이슈:`);
const bySprint = {};
for (const t of all) {
  const sid = t.sprint_id ?? "(none)";
  if (!bySprint[sid]) bySprint[sid] = { total: 0, done: 0, keys: [] };
  bySprint[sid].total++;
  if (t.status === "DONE") bySprint[sid].done++;
  bySprint[sid].keys.push(`${t.issue_key} [${t.status}]`);
}
for (const [sid, g] of Object.entries(bySprint)) {
  const name = sprintNameById[sid] ?? sid;
  console.log(`  ${name}: ${g.done}/${g.total} 완료`);
}

console.log(`\n이슈 목록 (${all.length}건):`);
for (const t of all) {
  const sp = sprintNameById[t.sprint_id] ?? t.sprint_id;
  const sub = t.is_subtask ? " (sub)" : "";
  console.log(`  ${t.issue_key} ${t.status.padEnd(12)} ${sp}${sub} — ${(t.summary ?? "").slice(0, 50)}`);
}

const { data: byName } = await supabase
  .from("jira_tasks")
  .select("issue_key, assignee_id, assignee_name, status")
  .ilike("assignee_name", "%송민준%");
const idMismatch = (byName ?? []).filter((t) => t.assignee_id !== memberId);
if (idMismatch.length > 0) {
  console.log(`\n⚠ assignee_name에 송민준이 있으나 id≠${memberId}: ${idMismatch.length}건 (앱 집계에 빠질 수 있음)`);
  for (const t of idMismatch) {
    console.log(`  ${t.issue_key} id=${t.assignee_id} [${t.status}]`);
  }
}
