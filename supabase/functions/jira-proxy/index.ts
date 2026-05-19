/**
 * JIRA REST 프록시 — GitHub Pages 등 브라우저 CORS 우회
 * Secrets: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jiraBase = Deno.env.get("JIRA_BASE_URL")?.trim().replace(/\/+$/, "");
  const jiraEmail = Deno.env.get("JIRA_EMAIL")?.trim();
  const jiraToken = Deno.env.get("JIRA_API_TOKEN")?.trim();

  if (!jiraBase || !jiraEmail || !jiraToken) {
    return json({ error: "JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN 시크릿을 Edge Function에 설정하세요." }, 500);
  }

  let path = "";
  let method = "GET";
  let bodyText: string | undefined;

  try {
    const payload = (await req.json()) as { path?: string; method?: string; body?: string };
    path = String(payload.path ?? "").trim();
    method = String(payload.method ?? "GET").toUpperCase();
    bodyText = payload.body;
  } catch {
    return json({ error: "JSON body 에 path 가 필요합니다." }, 400);
  }

  if (!path.startsWith("/rest/")) {
    return json({ error: "path 는 /rest/ 로 시작해야 합니다." }, 400);
  }

  const auth = btoa(`${jiraEmail}:${jiraToken}`);
  const res = await fetch(`${jiraBase}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "X-Atlassian-Token": "no-check",
      ...(bodyText ? { "Content-Type": "application/json" } : {}),
    },
    body: bodyText,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 400) };
  }

  if (!res.ok) {
    const b = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
    const msg =
      (Array.isArray(b?.errorMessages) ? (b!.errorMessages as string[]).join(" · ") : null) ||
      (b?.message ? String(b.message) : null) ||
      text.slice(0, 200);
    return json({ error: `JIRA HTTP ${res.status}: ${msg}` }, res.status);
  }

  return json({ ok: true, data }, res.status);
});
