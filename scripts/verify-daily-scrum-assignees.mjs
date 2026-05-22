/**
 * 데일리 스크럼 담당 이슈 표시 검증
 * node scripts/verify-daily-scrum-assignees.mjs [issueKey]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { JIRA_KIM_BOARD_KEYS } from "../tests/fixtures/fwk-kim-golden.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const issueKeyArg = process.argv[2]?.toUpperCase();

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
  console.warn("⏭️  skip: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 없음");
  process.exit(0);
}

const supabase = createClient(url, key);

const MEMBERS = [
  { id: "kim", name: "김희찬" },
  { id: "ki", name: "기충영" },
  { id: "song", name: "송민준" },
  { id: "shim", name: "심지훈" },
  { id: "oh", name: "오준열" },
  { id: "lee", name: "이지상" },
];

const { data: sprints } = await supabase
  .from("jira_sprints")
  .select("id, sprint_name, status, jira_sprint_id");

const { data: tasks, error } = await supabase
  .from("jira_tasks")
  .select(
    "issue_key, summary, status, sprint_id, assignee_id, assignee_name, jira_status_name, is_subtask"
  )
  .order("issue_key");

if (error) {
  console.error(error.message);
  process.exit(1);
}

function normalizeSprintState(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "future";
  if (s === "closed" || s.includes("종료") || s.includes("complete")) return "closed";
  if (s === "active" || s.includes("진행")) return "active";
  if (s === "future" || s.includes("예정")) return "future";
  return "future";
}

function sprintAppId(row) {
  return row.jira_sprint_id ?? row.id ?? row.sprint_name;
}

const sprintNameById = Object.fromEntries((sprints ?? []).map((s) => [sprintAppId(s), s.sprint_name]));
const activeSprints = (sprints ?? []).filter((s) => normalizeSprintState(s.status) === "active");
const activeIds = new Set(activeSprints.map((s) => sprintAppId(s)));

console.log("\n=== Daily Scrum 담당 이슈 검증 ===\n");
console.log(
  "앱 표시 조건: assignee 일치 + status !== DONE (스프린트 상태 무관, getMemberActiveAssignedTasks)\n"
);
console.log("동기화: 스프린트 이슈 + 보드 백로그(jira-backlog)\n");
console.log(`Active 스프린트 (${activeSprints.length}):`, activeSprints.map((s) => s.sprint_name).join(", ") || "(없음)");

if (issueKeyArg) {
  const row = (tasks ?? []).find((t) => t.issue_key === issueKeyArg);
  console.log(`\n--- ${issueKeyArg} ---`);
  if (!row) {
    console.log("DB에 없음 → JIRA 동기화 대상 밖(백로그·보드 밖) 가능성 높음");
  } else {
    console.log(JSON.stringify(row, null, 2));
    console.log("스프린트:", sprintNameById[row.sprint_id] ?? row.sprint_id);
    console.log(
      "active 스프린트 포함:",
      activeIds.has(row.sprint_id) ? "예" : "아니오 → 담당 이슈 패널에서 숨김"
    );
    const byName = (tasks ?? []).filter(
      (t) =>
        String(t.assignee_name).includes("희찬") &&
        t.issue_key.toUpperCase().startsWith(issueKeyArg.slice(0, 3))
    );
    if (byName.length) console.log("유사 이슈:", byName.map((t) => t.issue_key).join(", "));
    console.log("DONE 제외(active work):", row.status !== "DONE" ? "표시 가능" : "DONE → 숨김");
  }
}

for (const m of MEMBERS) {
  const all = (tasks ?? []).filter(
    (t) => t.assignee_id === m.id || String(t.assignee_name).trim() === m.name
  );
  const activeWork = all.filter((t) => t.status !== "DONE");
  const selectable = activeWork.filter((t) => t.status !== "TODO");
  console.log(`\n--- ${m.name} (${m.id}) ---`);
  console.log(`  DB 담당 전체: ${all.length} | 진행중(not DONE): ${activeWork.length}`);
  console.log(`  담당 이슈 패널 표시: ${activeWork.length} | 체크·저장 가능(IN_PROGRESS 등): ${selectable.length}`);

  if (activeWork.length > 0) {
    for (const t of activeWork) {
      const canSelect = t.status !== "TODO" ? "선택가능" : "표시만(TODO→JIRA에서 진행중 전환 후 선택)";
      console.log(
        `    ${t.issue_key} ${t.status} [${canSelect}] ${sprintNameById[t.sprint_id] ?? t.sprint_id ?? "(없음)"} — ${(t.summary ?? "").slice(0, 50)}`
      );
    }
  }

  if (m.id === "kim") {
    const keys = new Set(activeWork.map((t) => t.issue_key));
    const missing = JIRA_KIM_BOARD_KEYS.filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => k.startsWith("FWK-") && !JIRA_KIM_BOARD_KEYS.includes(k));
    console.log("  [JIRA 보드 대조 — 웹프레임워크 TF / 김희찬]");
    console.log(`    기대 키: ${JIRA_KIM_BOARD_KEYS.join(", ")}`);
    if (missing.length) console.log(`    DB 누락(동기화 필요): ${missing.join(", ")}`);
    if (extra.length) console.log(`    DB 추가 FWK-*: ${extra.join(", ")}`);
    if (!missing.length && !extra.length) console.log("    키 집합 일치");
    const todoOnBoard = activeWork.filter((t) => t.status === "TODO" && JIRA_KIM_BOARD_KEYS.includes(t.issue_key));
    if (todoOnBoard.length) {
      console.log(
        `    참고: JIRA '해야 할 일' ${todoOnBoard.map((t) => t.issue_key).join(", ")} → 앱에서 체크 불가(의도된 UX)`
      );
    }
  }
  const onlyActiveSprint = activeWork.filter((t) => activeIds.has(t.sprint_id));
  if (activeWork.length > 0 && onlyActiveSprint.length === 0) {
    console.log("  (참고: 예전 UI는 active 스프린트만 표시 → 0건이었음)");
  }
}

const unassignedKimName = (tasks ?? []).filter(
  (t) => t.assignee_name?.includes("희찬") || t.assignee_name?.includes("Hee")
);
if (unassignedKimName.length) {
  console.log("\n--- assignee_name 희찬/Hee 포함 (id 불일치 가능) ---");
  for (const t of unassignedKimName) {
    console.log(`  ${t.issue_key} id=${t.assignee_id} name=${t.assignee_name}`);
  }
}

console.log("");
