process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";

const envLines = fs.readFileSync(".env.local", "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
}
const url = env["VITE_SUPABASE_URL"], key = env["VITE_SUPABASE_ANON_KEY"];
const H = { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "Prefer": "return=minimal" };

const sel = await fetch(`${url}/rest/v1/scrum_notes?limit=1`, { headers: H });
console.log(`SELECT → ${sel.status === 200 ? "✅" : "❌"} ${sel.status}`);

const ins = await fetch(`${url}/rest/v1/scrum_notes`, {
  method: "POST", headers: H,
  body: JSON.stringify({ note_date: "1970-01-01", content: "test", category: "general", author_id: "__test__" }),
});
console.log(`INSERT → ${ins.status < 300 ? "✅" : "❌"} ${ins.status} ${(await ins.text()).slice(0, 120)}`);

await fetch(`${url}/rest/v1/scrum_notes?author_id=eq.__test__`, { method: "DELETE", headers: H });
console.log("Done");
