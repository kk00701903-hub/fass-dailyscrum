/**
 * 로그인 검증 후 PushSubscription을 DB에 저장 (GitHub Pages 등 정적 프론트용)
 * POST JSON: { loginId, password, subscription: { endpoint, keys: { p256dh, auth } } }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SubBody = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  let body: { loginId?: string; password?: string; subscription?: SubBody };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const loginId = body.loginId?.trim();
  const password = body.password ?? "";
  const sub = body.subscription;
  if (!loginId || !password || !sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return json({ error: "loginId, password, subscription.endpoint, subscription.keys required" }, 400);
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: loginJson, error: loginErr } = await sb.rpc("login_app_user", {
    p_login_id: loginId,
    p_password: password,
  });

  if (loginErr || !loginJson || typeof loginJson !== "object") {
    return json({ error: "로그인에 실패했습니다." }, 401);
  }

  const appUserId = (loginJson as Record<string, unknown>).id as string;
  if (!appUserId) {
    return json({ error: "Invalid login response" }, 500);
  }

  const { error: upsertSubErr } = await sb.from("push_subscriptions").upsert(
    {
      app_user_id: appUserId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: req.headers.get("user-agent") ?? undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (upsertSubErr) {
    console.error(upsertSubErr);
    return json({ error: "구독 저장에 실패했습니다." }, 500);
  }

  const { data: existingPref } = await sb
    .from("notification_preferences")
    .select("app_user_id")
    .eq("app_user_id", appUserId)
    .maybeSingle();

  if (!existingPref) {
    const { error: prefErr } = await sb.from("notification_preferences").insert({
      app_user_id: appUserId,
      scrum_reminder_enabled: true,
    });
    if (prefErr) {
      console.error(prefErr);
      return json({ error: "알림 기본 설정 생성 실패" }, 500);
    }
  }

  return json({ ok: true, appUserId });
});
