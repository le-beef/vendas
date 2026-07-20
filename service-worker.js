const CACHE_NAME = "le-beef-painel-v39";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./access.css",
  "./sales.css?v=16",
  "./layout.css",
  "./dashboard.css?v=28",
  "./mobile-participants.css?v=27",
  "./participant-filter.css",
  "./filter-counter.css",
  "./branding.css",
  "./whatsapp.css",
  "./whatsapp-icon.png",
  "./pwa.css",
  "./financial-report.css",
  "./auth-permissions.css",
  "./audit-log.css",
  "./payment-closing.css",
  "./event-access.css",
  "./access.js",
  "./excel-export.js?v=32",
  "./firebase-config.js",
  "./app.js?v=37",
  "./pwa.js",
  "./manifest.webmanifest",
  "./logo-le-beef.png",
  "./logo-le-beef-branca.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];
const STATIC_HOSTS = new Set(["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
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
        if (request.mode === "navigate") return caches.match("./index.html");
        throw new Error("Recurso indisponível offline.");
      })
  );
});
