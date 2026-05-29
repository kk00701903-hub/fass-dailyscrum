/**
 * 단일 SQL 마이그레이션을 Supabase Management API로 직접 실행
 * 사용: node scripts/apply-migration.mjs <sql-file-path>
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("사용법: node scripts/apply-migration.mjs <sql-file>");
  process.exit(1);
}

const sqlPath = path.isAbsolute(sqlFile) ? sqlFile : path.join(ROOT, sqlFile);
const sql = fs.readFileSync(sqlPath, "utf8");

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = "cvnyayoddcxhigjtyuqb";

if (!ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN 환경변수가 필요합니다.");
  process.exit(1);
}

console.log(`🔧 마이그레이션 실행: ${path.basename(sqlPath)}`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const body = await res.json();

if (!res.ok) {
  console.error("❌ 실행 실패:", JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log("✅ 마이그레이션 완료");
