/* eslint-disable no-undef */
/**
 * GitHub Pages + HashRouter: 배포 루트에 복사됨 (public/sw-push.js)
 */
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
