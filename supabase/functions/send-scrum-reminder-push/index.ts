/**
 * 매일 스크럼 미작성자에게 웹 푸시 (pg_cron / 외부 스케줄러에서 호출)
 * 헤더: X-Cron-Secret: <CRON_SECRET>  (Supabase Dashboard → Edge Functions → Secrets)
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

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

  const cronSecret = Deno.env.get("CRON_SECRET");
  const sent = req.headers.get("X-Cron-Secret");
  if (!cronSecret || sent !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:team@example.com";

  if (!supabaseUrl || !serviceKey || !publicKey || !privateKey) {
    return json({ error: "Server misconfigured (VAPID or Supabase)" }, 500);
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: targets, error: rpcErr } = await sb.rpc("web_push_scrum_reminder_targets");
  if (rpcErr) {
    console.error(rpcErr);
    return json({ error: rpcErr.message }, 500);
  }

  const rows = (targets ?? []) as TargetRow[];
  let sentCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  const base = Deno.env.get("PUBLIC_APP_URL")?.replace(/\/+$/, "");
  const openUrl = base ? `${base}/#/daily-scrum` : null;

  const payload = JSON.stringify({
    title: "데일리 스크럼 미입력",
    body: "오늘 날짜 스크럼을 아직 작성하지 않았습니다. 앱에서 입력해 주세요.",
    openUrl,
    tag: "scrum-reminder-daily",
  });

  for (const row of rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 86_400,
        urgency: "normal",
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

  return json({
    ok: true,
    targets: rows.length,
    sent: sentCount,
    failed: failCount,
    errors: errors.slice(0, 20),
  });
});
