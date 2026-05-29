// 앱이 사용하는 모든 테이블 접근성 확인
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";
const envLines = fs.readFileSync(".env.local", "utf8").split("\n");
const env = {};
for (const l of envLines) { const [k,...r]=l.split("="); if(k&&r.length) env[k.trim()]=r.join("=").trim().replace(/^["']|["']$/g,""); }
const url = env["VITE_SUPABASE_URL"], key = env["VITE_SUPABASE_ANON_KEY"];
const H = { "apikey": key, "Authorization": `Bearer ${key}` };

const tables = [
  "jira_sprints", "jira_tasks", "jira_sync_runs",
  "scrum_entries", "daily_reports", "scrum_task_logs",
  "team_member_display_settings", "scrum_notes",
  "jira_dependencies", "scrum_member_sprints",
  "rag_documents", "web_push_subscriptions",
];

console.log("테이블 접근 확인:");
for (const t of tables) {
  const r = await fetch(`${url}/rest/v1/${t}?limit=0`, { headers: H });
  const ok = r.status === 200 ? "✅" : `❌ ${r.status}`;
  console.log(`  ${t.padEnd(30)} ${ok}`);
}
