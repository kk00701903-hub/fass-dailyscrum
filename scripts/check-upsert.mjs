// daily_reports upsert with onConflict 테스트
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";

const envLines = fs.readFileSync(".env.local", "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
}
const url = env["VITE_SUPABASE_URL"], key = env["VITE_SUPABASE_ANON_KEY"];
const H = {
  "apikey": key, "Authorization": `Bearer ${key}`,
  "Content-Type": "application/json",
  "Prefer": "resolution=merge-duplicates,return=minimal",
};

const row = {
  member_id: "__upsert_test__",
  report_date: "1970-01-01",
  yesterday_achievement: "test-1",
  today_plan: "test-1",
  bottleneck: "없음",
  is_completed: false,
};

// 1차 upsert (INSERT)
const r1 = await fetch(`${url}/rest/v1/daily_reports?on_conflict=member_id%2Creport_date`, {
  method: "POST", headers: H, body: JSON.stringify(row),
});
console.log(`1차 upsert (INSERT) → ${r1.status < 300 ? "✅" : "❌"} ${r1.status} ${(await r1.text()).slice(0, 120)}`);

// 2차 upsert (UPDATE — 중복)
row.yesterday_achievement = "test-2";
const r2 = await fetch(`${url}/rest/v1/daily_reports?on_conflict=member_id%2Creport_date`, {
  method: "POST", headers: H, body: JSON.stringify(row),
});
console.log(`2차 upsert (UPDATE) → ${r2.status < 300 ? "✅" : "❌"} ${r2.status} ${(await r2.text()).slice(0, 120)}`);

// 정리
const del = await fetch(`${url}/rest/v1/daily_reports?member_id=eq.__upsert_test__`, {
  method: "DELETE", headers: { "apikey": key, "Authorization": `Bearer ${key}` },
});
console.log(`cleanup → ${del.status}`);
