/**
 * 스크럼 미입력 알림 ON/OFF (로그인 검증)
 * POST JSON:
 *  - 조회: { loginId, password, action: "get" }
 *  - 저장: { loginId, password, action: "set", scrumReminderEnabled: boolean }
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

  let body: {
    loginId?: string;
    password?: string;
    action?: string;
    scrumReminderEnabled?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const loginId = body.loginId?.trim();
  const password = body.password ?? "";
  const action = body.action ?? "get";

  if (!loginId || !password) {
    return json({ error: "loginId and password required" }, 400);
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

  if (action === "get") {
    const { data: pref, error } = await sb
      .from("notification_preferences")
      .select("scrum_reminder_enabled")
      .eq("app_user_id", appUserId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return json({ error: "설정 조회 실패" }, 500);
    }

    return json({
      scrumReminderEnabled: pref?.scrum_reminder_enabled ?? true,
    });
  }

  if (action === "set") {
    if (typeof body.scrumReminderEnabled !== "boolean") {
      return json({ error: "scrumReminderEnabled (boolean) required for set" }, 400);
    }

    const { error } = await sb.from("notification_preferences").upsert(
      {
        app_user_id: appUserId,
        scrum_reminder_enabled: body.scrumReminderEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "app_user_id" }
    );

    if (error) {
      console.error(error);
      return json({ error: "설정 저장 실패" }, 500);
    }

    return json({ ok: true, scrumReminderEnabled: body.scrumReminderEnabled });
  }

  return json({ error: "Unknown action" }, 400);
});
