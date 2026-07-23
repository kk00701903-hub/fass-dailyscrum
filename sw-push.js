/* eslint-disable no-undef */
/**
 * GitHub Pages + HashRouter 서비스워커
 * - Web Push 알림 (push / notificationclick)
 * - PWA 설치 및 오프라인 앱셸 캐싱 (install / activate / fetch)
 *
 * 배포 루트에 복사됨 (public/sw-push.js → /fass-dailyscrum/sw-push.js)
 */

const CACHE_VERSION = "fass-scrum-v2";
// SW 위치 기준 앱 베이스 경로 (예: /fass-dailyscrum/)
const BASE_PATH = new URL("./", self.location).pathname;
const APP_SHELL = [BASE_PATH, `${BASE_PATH}index.html`, `${BASE_PATH}logo.png`];

// ─── 설치: 앱셸 프리캐시 ────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // 개별 실패가 전체 설치를 막지 않도록 방어적으로 캐시
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

// ─── 활성화: 이전 버전 캐시 정리 ────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ─── fetch: 네비게이션은 network-first(앱셸 폴백), 정적 자원은 stale-while-revalidate ──
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 동일 오리진만 처리 (Supabase/JIRA 등 외부 API는 그대로 통과)
  if (url.origin !== self.location.origin) return;
  // API 성격의 경로는 캐시하지 않음
  if (url.pathname.includes("/api/")) return;

  // SPA 네비게이션 요청: 네트워크 우선, 실패 시 캐시된 index.html
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(CACHE_VERSION);
          const cached =
            (await cache.match(`${BASE_PATH}index.html`)) ||
            (await cache.match(BASE_PATH));
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 정적 자원(assets, 이미지 등): 캐시 우선 + 백그라운드 갱신
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});

// ─── Web Push 알림 ─────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = { title: "알림", body: "", openUrl: null, tag: "default" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    data.body = event.data?.text() ?? "";
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "logo.png",
      badge: "logo.png",
      tag: data.tag || "default",
      data: { openUrl: data.openUrl },
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const openUrl = event.notification.data?.openUrl || self.registration.scope;
  event.waitUntil(self.clients.openWindow(openUrl));
});
