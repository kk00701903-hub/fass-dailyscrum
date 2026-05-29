/**
 * rag_documents 테이블에 README.md 내용을 Supabase에 삽입/갱신합니다.
 * 실행: node scripts/seed-rag-documents.mjs
 * 필요: .env.local 에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 설정
 */
// 회사 네트워크/VPN SSL 인터셉트 환경 대응
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// .env.local 수동 파싱
const envPath = path.join(ROOT, ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌  .env.local 파일이 없습니다.");
  process.exit(1);
}
const envLines = fs.readFileSync(envPath, "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const SUPABASE_ANON_KEY = env["VITE_SUPABASE_ANON_KEY"];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌  VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY 가 .env.local 에 없습니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const documents = [
  {
    id: "readme",
    title: "ScrumRadar 개발자 인수인계 가이드",
    filePath: path.join(ROOT, "README.md"),
  },
];

for (const doc of documents) {
  if (!fs.existsSync(doc.filePath)) {
    console.warn(`⚠️  파일 없음: ${doc.filePath}`);
    continue;
  }

  const content = fs.readFileSync(doc.filePath, "utf8");

  const { error } = await supabase.from("rag_documents").upsert(
    { id: doc.id, title: doc.title, content, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );

  if (error) {
    console.error(`❌  ${doc.id} 삽입 실패:`, error.message);
  } else {
    console.log(`✅  ${doc.id} (${(content.length / 1024).toFixed(1)}KB) 삽입 완료`);
  }
}
