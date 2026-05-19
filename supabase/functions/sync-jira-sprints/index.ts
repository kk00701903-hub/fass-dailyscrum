import { createClient } from "npm:@supabase/supabase-js@2";

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

function statusLabel(state: string): string {
  if (state === "active") return "진행 중";
  if (state === "closed") return "종료";
  if (state === "future") return "예정";
  return state;
}

function remainingDays(endDate?: string): number {
  if (!endDate) return 0;
  const end = new Date(`${endDate.slice(0, 10)}T12:00:00`);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

async function jiraFetch<T>(baseUrl: string, auth: string, path: string): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "X-Atlassian-Token": "no-check",
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    const msg =
      (Array.isArray(b?.errorMessages) ? (b!.errorMessages as string[]).join(" · ") : null) ||
      (b?.message ? String(b.message) : null) ||
      text.slice(0, 200);
    throw new Error(`JIRA HTTP ${res.status}: ${msg}`);
  }
  return body as T;
}

async function fetchAllSprints(
  jiraBase: string,
  auth: string,
  boardId: string
): Promise<Array<{ sprint_name: string; status: string; remaining_days: number }>> {
  const maxResults = 50;
  const all: Array<{ name: string; state: string; endDate?: string }> = [];
  let startAt = 0;

  for (;;) {
    const path = `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&startAt=${startAt}&maxResults=${maxResults}`;
    const page = await jiraFetch<{
      values: Array<{ name: string; state: string; endDate?: string }>;
      isLast?: boolean;
    }>(jiraBase, auth, path);

    all.push(...(page.values ?? []));
    if (page.isLast === true) break;
    if ((page.values?.length ?? 0) < maxResults) break;
    startAt += maxResults;
    if (startAt > 500) break;
  }

  const byName = new Map<string, { sprint_name: string; status: string; remaining_days: number }>();
  for (const sp of all) {
    if (!sp.name?.trim()) continue;
    byName.set(sp.name, {
      sprint_name: sp.name,
      status: statusLabel(sp.state),
      remaining_days: remainingDays(sp.endDate),
    });
  }
  return [...byName.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const jiraBase = Deno.env.get("JIRA_BASE_URL")?.trim();
  const jiraEmail = Deno.env.get("JIRA_EMAIL")?.trim();
  const jiraToken = Deno.env.get("JIRA_API_TOKEN")?.trim();
  const boardId = Deno.env.get("JIRA_BOARD_ID")?.trim();

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다." }, 500);
  }
  if (!jiraBase || !jiraEmail || !jiraToken) {
    return json({ error: "JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN 시크릿을 설정하세요." }, 500);
  }
  if (!boardId || !/^\d+$/.test(boardId)) {
    return json({ error: "JIRA_BOARD_ID(숫자) 시크릿을 설정하세요." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const auth = btoa(`${jiraEmail}:${jiraToken}`);

  try {
    const rows = await fetchAllSprints(jiraBase, auth, boardId);
    const now = new Date().toISOString();

    const { error: deleteError } = await supabase.from("jira_sprints").delete().not("sprint_name", "is", null);
    if (deleteError) throw deleteError;

    if (rows.length === 0) {
      return json({ ok: true, count: 0, mode: "full_replace" });
    }

    const { error: insertError } = await supabase.from("jira_sprints").insert(
      rows.map((r) => ({ ...r, updated_at: now }))
    );
    if (insertError) throw insertError;

    return json({ ok: true, count: rows.length, mode: "full_replace" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
