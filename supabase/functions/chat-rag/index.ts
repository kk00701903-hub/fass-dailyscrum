/**
 * ScrumRadar RAG 챗봇 — Anthropic Claude + rag_documents 컨텍스트
 * Secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (자동 주입)
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT_PREFIX = `당신은 ScrumRadar 시스템 어시스턴트입니다.
ScrumRadar는 FASS 팀의 데일리 스크럼 관리 웹 애플리케이션으로, JIRA 연동·스프린트 관리·팀원 스크럼 입력·WBS 간트 차트 등을 제공합니다.

아래 문서를 바탕으로 사용자의 질문에 한국어로 정확하고 친절하게 답변하세요.
문서에 없는 내용은 "해당 내용은 문서에서 확인할 수 없습니다"라고 명확히 밝히세요.
답변은 간결하게, 필요 시 마크다운 형식(목록, 코드블록)을 사용하세요.

=== ScrumRadar 문서 시작 ===
`;

const SYSTEM_PROMPT_SUFFIX = `
=== ScrumRadar 문서 끝 ===`;

type Message = {
  role: "user" | "assistant";
  content: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!anthropicKey) {
    return json({ error: "ANTHROPIC_API_KEY 시크릿을 Edge Function에 설정하세요." }, 500);
  }


  let message = "";
  let history: Message[] = [];

  try {
    const body = await req.json() as { message?: string; history?: Message[] };
    message = String(body.message ?? "").trim();
    history = Array.isArray(body.history) ? body.history : [];
  } catch {
    return json({ error: "올바른 JSON body가 필요합니다. { message, history }" }, 400);
  }

  if (!message) {
    return json({ error: "message 필드가 비어 있습니다." }, 400);
  }

  // rag_documents 에서 README 내용 로드
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: docs, error: dbError } = await supabase
    .from("rag_documents")
    .select("content")
    .eq("id", "readme")
    .limit(1);

  if (dbError || !docs?.length) {
    return json({ error: "RAG 문서를 불러오지 못했습니다. seed-rag-documents.mjs 를 먼저 실행하세요." }, 500);
  }

  const context = docs[0].content as string;
  const systemPrompt = SYSTEM_PROMPT_PREFIX + context + SYSTEM_PROMPT_SUFFIX;

  // 대화 히스토리 최대 10턴 유지 (토큰 절약)
  const trimmedHistory = history.slice(-10);

  const anthropicMessages = [
    ...trimmedHistory,
    { role: "user" as const, content: message },
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic API 오류:", response.status, errText);
    return json({ error: `Anthropic API 오류: ${response.status}` }, 500);
  }

  const result = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const reply = result.content?.find((c) => c.type === "text")?.text ?? "";
  return json({ reply });
});
