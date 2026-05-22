/**
 * 설정 화면에서 입력한 문구로 웹 푸시 수동 발송 (로그인 검증)
 * POST JSON: {
 *   loginId, password,
 *   title?: string,
 *   body: string,
 *   memberIds?: string[]   // 비우거나 생략 시 구독한 전체
 * }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TITLE = 120;
const MAX_BODY = 500;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type TargetRow = {
  app_user_id: string;
  member_id: string;
  display_name: string;
  endpoint: string;
  p256dh: string;
  auth: string;
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
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:team@example.com";

  if (!supabaseUrl || !serviceKey || !publicKey || !privateKey) {
    return json({ error: "Server misconfigured (VAPID or Supabase)" }, 500);
  }

  let body: {
    loginId?: string;
    password?: string;
    title?: string;
    body?: string;
    memberIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const loginId = body.loginId?.trim();
  const password = body.password ?? "";
  const messageBody = body.body?.trim() ?? "";

  if (!loginId || !password) {
    return json({ error: "loginId and password required" }, 400);
  }
  if (!messageBody) {
    return json({ error: "body (알림 내용) required" }, 400);
  }
  if (messageBody.length > MAX_BODY) {
    return json({ error: `body must be at most ${MAX_BODY} characters` }, 400);
  }

  const title = (body.title?.trim() || "팀 알림").slice(0, MAX_TITLE);

  const memberIds = Array.isArray(body.memberIds)
    ? [...new Set(body.memberIds.map((id) => String(id).trim()).filter(Boolean))]
    : null;

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: loginJson, error: loginErr } = await sb.rpc("login_app_user", {
    p_login_id: loginId,
    p_password: password,
  });

  if (loginErr || !loginJson || typeof loginJson !== "object") {
    return json({ error: "로그인에 실패했습니다." }, 401);
  }

  const senderName =
    ((loginJson as Record<string, unknown>).display_name as string | undefined)?.trim() ||
    loginId;

  const { data: targets, error: rpcErr } = await sb.rpc("web_push_manual_targets", {
    p_member_ids: memberIds && memberIds.length > 0 ? memberIds : null,
  });

  if (rpcErr) {
    console.error(rpcErr);
    return json({ error: rpcErr.message }, 500);
  }

  const rows = (targets ?? []) as TargetRow[];
  if (rows.length === 0) {
    return json({
      ok: true,
      targets: 0,
      sent: 0,
      failed: 0,
      message: "푸시 구독이 있는 대상이 없습니다.",
    });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const base = Deno.env.get("PUBLIC_APP_URL")?.replace(/\/+$/, "");
  const openUrl = base ? `${base}/#/` : null;

  const payload = JSON.stringify({
    title,
    body: messageBody,
    openUrl,
    tag: `manual-${Date.now()}`,
  });

  let sentCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 86_400,
        urgency: "high",
      });
      sentCount++;
    } catch (e: unknown) {
      failCount++;
      const status =
        typeof e === "object" && e !== null && "statusCode" in e ? (e as { statusCode: number }).statusCode : 0;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${row.member_id}: ${msg}`);

      if (status === 404 || status === 410) {
        await sb.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      }
    }
  }

  console.log(`manual push by ${senderName}: targets=${rows.length} sent=${sentCount} failed=${failCount}`);

  return json({
    ok: true,
    targets: rows.length,
    sent: sentCount,
    failed: failCount,
    errors: errors.slice(0, 20),
    sentBy: senderName,
  });
});
