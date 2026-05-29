process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";
const envLines = fs.readFileSync(".env.local", "utf8").split("\n");
const env = {};
for (const l of envLines) { const [k,...r]=l.split("="); if(k&&r.length) env[k.trim()]=r.join("=").trim().replace(/^["']|["']$/g,""); }
const url = env["VITE_SUPABASE_URL"], key = env["SUPABASE_SERVICE_ROLE_KEY"] || env["SERVICE_ROLE_KEY"];
const sql = fs.readFileSync("supabase/migrations/20260529190000_fix_jira_sync_runs.sql", "utf8");

const r = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ sql })
});

if (!r.ok) {
  // Try direct pg via supabase management API
  const r2 = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  console.log("pg/query status:", r2.status, await r2.text());
} else {
  console.log("✅ 마이그레이션 적용 완료");
}
