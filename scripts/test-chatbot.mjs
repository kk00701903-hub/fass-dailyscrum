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

const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const SUPABASE_ANON_KEY = env["VITE_SUPABASE_ANON_KEY"];
const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

console.log("🔍 Edge Function 챗봇 테스트...");
const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-rag`, {
  method: "POST",
  headers,
  body: JSON.stringify({ message: "전일 불러오기 기능이 뭔가요?", history: [] }),
});

const data = await res.json();

if (!res.ok || data.error) {
  console.error("❌ 오류:", data.error ?? res.status);
} else {
  console.log("✅ 챗봇 정상 동작!");
  console.log("\n[응답 미리보기]");
  console.log(data.reply?.slice(0, 500) + (data.reply?.length > 500 ? "..." : ""));
}
