/**
 * GitHub Pages(Vite) + Supabase Edge Function용 웹 푸시 구독 헬퍼 (React에서 호출)
 *
 * 필요 환경변수:
 * - VITE_WEB_PUSH_PUBLIC_KEY  (VAPID 공개키, Base64 URL)
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function functionsUrl(): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/functions/v1`;
}

function anonHeaders(): HeadersInit {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!anon) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${anon}`,
    apikey: anon,
  };
}

/** 알림 권한 요청 → SW 등록 → PushManager 구독 → Edge Function으로 subscription 저장 */
export async function registerWebPushSubscription(
  loginId: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const vapid = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;
  const fn = functionsUrl();
  if (!vapid?.trim() || !fn) {
    return { ok: false, error: "VITE_WEB_PUSH_PUBLIC_KEY 또는 VITE_SUPABASE_URL이 없습니다." };
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "이 브라우저는 웹 푸시를 지원하지 않습니다." };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, error: "알림 권한이 필요합니다." };
  }

  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const swUrl = `${base}sw-push.js`;
  const reg = await navigator.serviceWorker.register(swUrl, {
    scope: base,
  });
  await reg.update();

  let sub: PushSubscription;
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.trim()),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "구독 실패" };
  }

  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) {
    return { ok: false, error: "PushSubscription JSON이 불완전합니다." };
  }

  const res = await fetch(`${fn}/register-push-subscription`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({
      loginId,
      password,
      subscription: {
        endpoint: j.endpoint,
        keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
      },
    }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) msg = errBody.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg };
  }

  return { ok: true };
}

export async function fetchScrumReminderPreference(
  loginId: string,
  password: string
): Promise<{ scrumReminderEnabled: boolean } | { error: string }> {
  const fn = functionsUrl();
  if (!fn) return { error: "VITE_SUPABASE_URL이 없습니다." };

  const res = await fetch(`${fn}/push-notification-preferences`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({ loginId, password, action: "get" }),
  });
  if (!res.ok) return { error: (await res.text()) || `HTTP ${res.status}` };
  return (await res.json()) as { scrumReminderEnabled: boolean };
}

export async function setScrumReminderPreference(
  loginId: string,
  password: string,
  scrumReminderEnabled: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fn = functionsUrl();
  if (!fn) return { ok: false, error: "VITE_SUPABASE_URL이 없습니다." };

  const res = await fetch(`${fn}/push-notification-preferences`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({ loginId, password, action: "set", scrumReminderEnabled }),
  });
  if (!res.ok) {
    return { ok: false, error: (await res.text()) || `HTTP ${res.status}` };
  }
  return { ok: true };
}

export type ManualPushResult =
  | {
      ok: true;
      targets: number;
      sent: number;
      failed: number;
      message?: string;
      sentBy?: string;
      errors?: string[];
    }
  | { ok: false; error: string };

/** 설정 화면에서 입력한 제목·본문으로 구독자에게 웹 푸시 발송 */
export async function sendManualPushNotification(
  loginId: string,
  password: string,
  input: { title?: string; body: string; memberIds?: string[] }
): Promise<ManualPushResult> {
  const fn = functionsUrl();
  if (!fn) return { ok: false, error: "VITE_SUPABASE_URL이 없습니다." };

  const body = input.body.trim();
  if (!body) return { ok: false, error: "알림 내용을 입력해 주세요." };

  const res = await fetch(`${fn}/send-manual-push`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({
      loginId,
      password,
      title: input.title?.trim() || undefined,
      body,
      memberIds: input.memberIds?.length ? input.memberIds : undefined,
    }),
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: (await res.text()) || `HTTP ${res.status}` };
  }

  if (!res.ok) {
    return { ok: false, error: (payload.error as string) || `HTTP ${res.status}` };
  }

  return {
    ok: true,
    targets: Number(payload.targets) || 0,
    sent: Number(payload.sent) || 0,
    failed: Number(payload.failed) || 0,
    message: payload.message as string | undefined,
    sentBy: payload.sentBy as string | undefined,
    errors: Array.isArray(payload.errors) ? (payload.errors as string[]) : undefined,
  };
}

export function isWebPushConfigured(): boolean {
  const vapid = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;
  return Boolean(vapid?.trim() && functionsUrl());
}
