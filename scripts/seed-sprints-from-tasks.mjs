// jira_tasks 의 sprint_id 에서 jira_sprints 데이터를 복원합니다.
// JIRA 동기화 없이도 WBS·의존성 화면이 동작할 수 있도록 최소한의 sprint 레코드를 생성합니다.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";

const envLines = fs.readFileSync(".env.local", "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
}
const url = env["VITE_SUPABASE_URL"], key = env["VITE_SUPABASE_ANON_KEY"];
const H = { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" };

// 1) jira_tasks 에서 sprint_id, start_date, due_date 집계
const rt = await fetch(
  `${url}/rest/v1/jira_tasks?select=sprint_id,start_date,due_date,created_at&limit=500`,
  { headers: H }
);
const tasks = await rt.json();
console.log(`jira_tasks 조회: ${rt.status} / ${tasks?.length ?? 0}건`);

// 2) sprint_id별 날짜 범위 집계
const sprintMeta = {};
for (const t of (tasks ?? [])) {
  const sid = t.sprint_id;
  if (!sid || sid === "jira-backlog") continue;
  if (!sprintMeta[sid]) sprintMeta[sid] = { minDate: null, maxDate: null, count: 0 };
  const m = sprintMeta[sid];
  m.count++;
  for (const d of [t.start_date, t.due_date, t.created_at]) {
    if (!d) continue;
    const ds = d.slice(0, 10);
    if (!m.minDate || ds < m.minDate) m.minDate = ds;
    if (!m.maxDate || ds > m.maxDate) m.maxDate = ds;
  }
}

// 3) sprint 번호로 정렬해서 최신 3개는 active/future, 나머지는 closed
const sprintIds = Object.keys(sprintMeta).sort((a, b) => {
  const na = parseInt(a.replace(/\D/g, "")) || 0;
  const nb = parseInt(b.replace(/\D/g, "")) || 0;
  return na - nb;
});
console.log(`\n집계된 sprint_id (${sprintIds.length}개):`, sprintIds.join(", "));

// 4) jira_sprints 레코드 생성
const rows = [];
const now = new Date().toISOString();
for (let i = 0; i < sprintIds.length; i++) {
  const sid = sprintIds[i];
  const m = sprintMeta[sid];
  const num = parseInt(sid.replace(/\D/g, "")) || i + 1;
  const isRecent = i >= sprintIds.length - 3;
  const state = isRecent ? (i === sprintIds.length - 1 ? "active" : "future") : "closed";
  
  // 날짜 기본값: 없으면 스프린트 번호 기반으로 추산
  const startDate = m.minDate ?? `2026-0${Math.min(9, Math.floor(i / 2) + 1)}-01`;
  const endDate = m.maxDate ?? `2026-0${Math.min(9, Math.floor(i / 2) + 1)}-30`;

  rows.push({
    id: sid,
    name: `Sprint ${num}`,
    sprint_name: `Sprint ${num}`,
    state,
    status: state,
    start_date: startDate,
    end_date: endDate,
    goal: "",
    board_id: null,
    jira_sprint_id: String(num),
    synced_at: now,
  });
}

// backlog 추가
rows.push({
  id: "jira-backlog",
  name: "Backlog",
  sprint_name: "Backlog",
  state: "active",
  status: "active",
  start_date: "2026-01-01",
  end_date: "2099-12-31",
  goal: "",
  board_id: null,
  jira_sprint_id: "0",
  synced_at: now,
});

// 5) upsert
const ru = await fetch(
  `${url}/rest/v1/jira_sprints?on_conflict=id`,
  {
    method: "POST",
    headers: { ...H, "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  }
);
const body = await ru.text();
console.log(`\njira_sprints upsert → ${ru.status}: ${body.slice(0, 200)}`);

// 6) 결과 확인
const rc = await fetch(`${url}/rest/v1/jira_sprints?select=id,name,state,start_date,end_date&order=id.asc`, { headers: H });
const result = await rc.json();
console.log(`\n저장된 스프린트 (${result?.length ?? 0}건):`);
for (const s of (result ?? [])) {
  console.log(`  ${s.id} | ${s.name} | ${s.state} | ${s.start_date} ~ ${s.end_date}`);
}
