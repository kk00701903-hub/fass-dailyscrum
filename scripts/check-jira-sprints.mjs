process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";
const envLines = fs.readFileSync(".env.local", "utf8").split("\n");
const env = {};
for (const l of envLines) { const [k,...r]=l.split("="); if(k&&r.length) env[k.trim()]=r.join("=").trim().replace(/^["']|["']$/g,""); }
const url = env["VITE_SUPABASE_URL"], key = env["VITE_SUPABASE_ANON_KEY"];
const H = { "apikey": key, "Authorization": `Bearer ${key}` };

const rs = await fetch(`${url}/rest/v1/jira_sprints?select=id,name,sprint_name,state,status,start_date,end_date&order=id.asc`, { headers: H });
const sprints = await rs.json();
console.log(`\njira_sprints: ${rs.status} / 총 ${sprints?.length ?? 0}건`);

const byState = {};
for (const s of (sprints ?? [])) {
  const st = s.state || s.status || "?";
  byState[st] = (byState[st] ?? 0) + 1;
}
console.log("상태별:", JSON.stringify(byState));

// jira_tasks 건수 확인
const rt = await fetch(`${url}/rest/v1/jira_tasks?select=sprint_id&limit=500`, { headers: H });
const tasks = await rt.json();
const sprintIds = new Set((tasks??[]).map(t=>t.sprint_id));
console.log(`\njira_tasks 건수: ${tasks?.length ?? 0}, 고유 sprint_id: ${sprintIds.size}개`);

// tasks의 sprint_id와 sprints의 id 매칭률
const sprintIdSet = new Set((sprints??[]).map(s=>s.id));
let matched = 0;
for (const sid of sprintIds) { if (sprintIdSet.has(sid)) matched++; }
console.log(`tasks→sprints 매칭: ${matched}/${sprintIds.size} sprint_id 가 jira_sprints 에 존재`);
