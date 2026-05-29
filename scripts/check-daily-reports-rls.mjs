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

// Test INSERT into daily_reports with a dummy row
const testRow = {
  member_id: "__rls_test__",
  report_date: "1970-01-01",
  yesterday_achievement: "",
  today_plan: "",
  bottleneck: "없음",
  is_completed: false,
};

console.log("🔍 daily_reports INSERT 권한 테스트...");
const res = await fetch(`${url}/rest/v1/daily_reports`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Prefer": "return=minimal",
  },
  body: JSON.stringify(testRow),
});

if (res.ok || res.status === 409) {
  console.log("✅ INSERT 정책 정상 (status:", res.status, ")");
  // 테스트 행 삭제
  await fetch(`${url}/rest/v1/daily_reports?member_id=eq.__rls_test__`, {
    method: "DELETE",
    headers: { "apikey": key, "Authorization": `Bearer ${key}` },
  });
} else {
  const body = await res.text();
  console.error("❌ INSERT 실패 (status:", res.status, "):", body);
}

// Test SELECT
console.log("\n🔍 daily_reports SELECT 권한 테스트...");
const selRes = await fetch(`${url}/rest/v1/daily_reports?limit=1`, {
  headers: { "apikey": key, "Authorization": `Bearer ${key}` },
});
if (selRes.ok) {
  const rows = await selRes.json();
  console.log("✅ SELECT 정상, 행 수:", rows.length);
} else {
  console.error("❌ SELECT 실패:", await selRes.text());
}
