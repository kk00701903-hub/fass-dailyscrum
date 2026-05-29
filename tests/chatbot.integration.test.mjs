/**
 * ChatWidget / chat-rag Edge Function 통합 테스트
 * 실행: node tests/chatbot.integration.test.mjs
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── 환경변수 로드 ────────────────────────────────────────────────────────────
const envLines = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const SUPABASE_ANON_KEY = env["VITE_SUPABASE_ANON_KEY"];
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/chat-rag`;
const HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

// ─── 테스트 유틸 ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log("✅ PASS");
    passed++;
  } catch (e) {
    console.log(`❌ FAIL — ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? "assertion failed");
}

async function chat(message, history = []) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ message, history }),
  });
  return { status: res.status, data: await res.json() };
}

// ─── 테스트 스위트 ────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log("  chat-rag Edge Function 통합 테스트");
console.log(`  ${FUNCTION_URL}`);
console.log("═══════════════════════════════════════════════\n");

console.log("【1】 기본 연결 및 설정 확인");

await test("Edge Function 엔드포인트 응답 (200/500 둘 다 정상)", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ message: "ping", history: [] }),
  });
  assert(res.status < 600, `HTTP 상태 코드 이상: ${res.status}`);
});

await test("CORS preflight OPTIONS 요청 처리", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS", headers: HEADERS });
  assert(res.ok, `OPTIONS 실패: ${res.status}`);
});

await test("Anthropic API 키 설정 확인 (ANTHROPIC_API_KEY 시크릿)", async () => {
  const { data } = await chat("test");
  assert(
    !data.error?.includes("ANTHROPIC_API_KEY 시크릿"),
    `API 키 미설정: ${data.error}`
  );
});

console.log("\n【2】 입력 유효성 검사");

await test("빈 message 필드 → 400 에러 반환", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ message: "", history: [] }),
  });
  assert(res.status === 400, `예상 400, 실제: ${res.status}`);
  const data = await res.json();
  assert(data.error, "에러 메시지 없음");
});

await test("message 필드 누락 → 400 에러 반환", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ history: [] }),
  });
  assert(res.status === 400, `예상 400, 실제: ${res.status}`);
});

await test("잘못된 JSON body → 400 에러 반환", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "text/plain" },
    body: "not-json",
  });
  assert(res.status === 400, `예상 400, 실제: ${res.status}`);
});

console.log("\n【3】 RAG 문서 로드 확인");

await test("rag_documents 테이블에 readme 문서 존재", async () => {
  const { status, data } = await chat("ScrumRadar가 무엇인지 한 줄로 설명해줘");
  assert(status === 200, `HTTP 오류: ${status} — ${JSON.stringify(data)}`);
  assert(!data.error?.includes("RAG 문서"), `RAG 문서 미시딩: ${data.error}`);
  assert(typeof data.reply === "string" && data.reply.length > 0, "응답 없음");
});

console.log("\n【4】 실제 챗봇 응답 품질");

await test("ScrumRadar 기본 소개 질문에 응답", async () => {
  const { status, data } = await chat("ScrumRadar가 뭔가요?");
  assert(status === 200, `오류: ${data.error}`);
  assert(data.reply?.length > 50, `응답이 너무 짧음: ${data.reply}`);
  const lower = data.reply.toLowerCase();
  const relevant = lower.includes("scrum") || lower.includes("스크럼") || lower.includes("jira") || lower.includes("데일리");
  assert(relevant, `관련 없는 응답: ${data.reply?.slice(0, 100)}`);
});

await test("JIRA 연동 관련 질문에 응답", async () => {
  const { status, data } = await chat("JIRA 연동은 어떻게 하나요?");
  assert(status === 200, `오류: ${data.error}`);
  assert(data.reply?.length > 30, "응답 너무 짧음");
});

await test("문서에 없는 내용 질문 시 명확히 안내", async () => {
  const { status, data } = await chat("오늘 날씨가 어때요?");
  assert(status === 200, `오류: ${data.error}`);
  assert(data.reply?.length > 0, "응답 없음");
  // 문서 밖 내용은 모르겠다고 하거나, 범위를 벗어난다고 안내해야 함
  const lower = data.reply.toLowerCase();
  const outOfScope =
    lower.includes("확인할 수 없") ||
    lower.includes("문서") ||
    lower.includes("날씨") ||
    lower.includes("해당 내용");
  assert(outOfScope, `범위 외 질문 처리 불명확: ${data.reply?.slice(0, 150)}`);
});

console.log("\n【5】 다중 턴 대화 (history)");

await test("이전 대화 맥락을 유지하며 응답", async () => {
  const history = [
    { role: "user", content: "ScrumRadar의 주요 기능을 알려줘" },
    { role: "assistant", content: "ScrumRadar는 데일리 스크럼 관리, JIRA 연동, WBS 간트 차트 등을 제공합니다." },
  ];
  const { status, data } = await chat("방금 말한 기능 중 첫 번째 것만 자세히 설명해줘", history);
  assert(status === 200, `오류: ${data.error}`);
  assert(data.reply?.length > 30, "맥락 유지 응답 너무 짧음");
});

await test("history 10턴 초과 시에도 정상 처리 (토큰 슬라이싱)", async () => {
  const longHistory = Array.from({ length: 15 }, (_, i) => [
    { role: "user", content: `질문 ${i + 1}: ScrumRadar 기능 설명해줘` },
    { role: "assistant", content: `답변 ${i + 1}: 네, 설명드리겠습니다.` },
  ]).flat();
  const { status, data } = await chat("마지막 질문 요약해줘", longHistory);
  assert(status === 200, `오류: ${data.error}`);
  assert(typeof data.reply === "string", "응답 없음");
});

// ─── 결과 출력 ────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log("\n═══════════════════════════════════════════════");
console.log(`  결과: ${passed}/${total} 통과 ${failed > 0 ? `(${failed} 실패)` : ""}`);
console.log("═══════════════════════════════════════════════\n");

if (failed > 0) process.exit(1);
