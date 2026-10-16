const CACHE_NAME = "le-beef-painel-v6-4-0-2";
const CACHE_PREFIX = "le-beef-painel-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=2",
  "./access.css",
  "./sales.css?v=18",
  "./layout.css?v=2",
  "./dashboard.css?v=31",
  "./notifications.css?v=1",
  "./mobile-participants.css?v=27",
  "./participant-filter.css?v=15",
  "./filter-counter.css?v=9",
  "./branding.css?v=10",
  "./whatsapp.css?v=23",
  "./whatsapp-icon.png",
  "./pwa.css?v=7",
  "./financial-report.css?v=21",
  "./financial-settings.css?v=1",
  "./promoters.css?v=3",
  "./promoter-report.css?v=1",
  "./settlements.css?v=1",
  "./online-sales.css?v=1",
  "./auth-permissions.css?v=20",
  "./audit-log.css?v=27",
  "./payment-closing.css?v=28",
  "./event-access.css?v=18",
  "./toast-responsive.css?v=1",
  "./table-map.css?v=16",
  "./map-layouts.css?v=9",
  "./table-reservation-override.css?v=2",
  "./table-reservation-details.css?v=2",
  "./table-reservation-final.css?v=3",
  "./table-reservation-harmony.css?v=4",
  "./ticketing.css?v=13",
  "./ticket-config.css?v=8",
  "./excel-export.js?v=40",
  "./firebase-config.js",
  "./app.js?v=135",
  "./notifications.js?v=2",
  "./map-layouts.js?v=4",
  "./financial-core.js?v=2",
  "./pages.js?v=12",
  "./qr-scanner-tools.js?v=1",
  "./ticket-tools.js?v=15",
  "./thermal-print.js?v=10",
  "./ticket-layout.js?v=3",
  "./pages.css?v=5",
  "./event-archive.js?v=1",
  "./comprar.html",
  "./ingresso.html",
  "./ingresso.js?v=1",
  "./online-store.css?v=2",
  "./pwa.js",
  "./manifest.webmanifest",
  "./logo-le-beef.png",
  "./logo-le-beef-branca.png",
  "./icon-192.png?v=19",
  "./icon-512.png?v=19",
  "./icon-maskable-512.png?v=19",
  "./mesa-icon.png",
  "./bistro-icon.png",
  "./salao-fundo.png",
  "./mezanino-fundo.png",
  "./salao-grade-6x4.png",
  "./salao-grade-6x5.png",
  "./salao-grade-7x5.png",
  "./salao-grade-8x5.png",
  "./mezanino-grade-13.png"
];
const STATIC_HOSTS = new Set(["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"]);

try {
  importScripts(
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js"
  );
  firebase.initializeApp({
    apiKey: "AIzaSyBLoBE2jT9QbmB5FpYJP4IYRDGFzd07Hx8",
    authDomain: "vendas-76f49.firebaseapp.com",
    projectId: "vendas-76f49",
    messagingSenderId: "658944606398",
    appId: "1:658944606398:web:060a4801f9f4d90ef39eef"
  });
  firebase.messaging().onBackgroundMessage((payload) => {
    const data = payload?.data || {};
    self.registration.showNotification(data.title || "Le Beef", {
      body: data.body || "Há uma atualização em um evento.",
      icon: data.icon || "./icon-192.png?v=19",
      badge: data.badge || "./icon-192.png?v=19",
      tag: `le-beef-${data.eventId || "evento"}-${data.type || "atualizacao"}`,
      renotify: true,
      data: { url: data.url || "./#eventos" }
    });
  });
} catch (error) {
  console.warn("As notificações em segundo plano não puderam ser iniciadas.", error);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./#eventos", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if ("navigate" in client) await client.navigate(targetUrl);
      if ("focus" in client) return client.focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
  }));
});

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isLocal = url.origin === self.location.origin;
  if (!isLocal && !STATIC_HOSTS.has(url.hostname)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          if (url.pathname.endsWith("/ingresso.html") || url.pathname.endsWith("/comprar.html")) {
            return new Response("Esta página não está disponível sem conexão. Conecte-se e tente novamente.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
          }
          return caches.match("./index.html");
        }
        throw new Error("Recurso indisponível offline.");
      })
  );
});
