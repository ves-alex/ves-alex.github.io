const CACHE_NAME = "nudge-v35";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
      self.clients.claim(),
    ]).then(() =>
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          if ("navigate" in client) client.navigate(client.url);
        });
      })
    )
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Nudge", body: "C'est l'heure de ta prochaine action." };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: "nudge-reminder",
      data: { url: payload.url || "./" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
