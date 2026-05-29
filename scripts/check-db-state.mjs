process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const envLines = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
}
const url = env["VITE_SUPABASE_URL"];
const key = env["VITE_SUPABASE_ANON_KEY"];
const H = { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" };

async function testTable(name, method = "GET", body = null) {
  const endpoint = method === "GET"
    ? `${url}/rest/v1/${name}?limit=1`
    : `${url}/rest/v1/${name}`;
  const opts = { method, headers: { ...H, "Prefer": "return=minimal" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(endpoint, opts);
  const text = await r.text();
  let msg = "";
  try { msg = JSON.parse(text)?.message ?? text; } catch { msg = text.slice(0, 120); }
  return { status: r.status, msg };
}

const tables = ["daily_reports", "scrum_entries", "scrum_task_logs"];
console.log("═══════════════════════════════════════════");
console.log("  DB 테이블 권한 점검");
console.log("═══════════════════════════════════════════");

for (const t of tables) {
  const sel = await testTable(t, "GET");
  console.log(`\n[${t}]`);
  console.log(`  SELECT → ${sel.status === 200 ? "✅" : "❌"} ${sel.status} ${sel.msg.slice(0, 80)}`);

  const testRow = t === "daily_reports"
    ? { member_id: "__test__", report_date: "1970-01-01", yesterday_achievement: "", today_plan: "", bottleneck: "없음", is_completed: false }
    : t === "scrum_entries"
    ? { entry_date: "1970-01-01", sprint_id: "__test__", member_id: "__test__", yesterday: "", today: "", blockers: "없음", selected_tasks: [] }
    : { entry_date: "1970-01-01", sprint_id: "__test__", member_id: "__test__", issue_key: "__test__", yesterday: "", today: "" };

  const ins = await testTable(t, "POST", testRow);
  console.log(`  INSERT → ${ins.status < 300 || ins.status === 409 ? "✅" : "❌"} ${ins.status} ${ins.msg.slice(0, 80)}`);

  // cleanup
  await fetch(`${url}/rest/v1/${t}?member_id=eq.__test__`, { method: "DELETE", headers: H });
}
console.log("\n═══════════════════════════════════════════");
