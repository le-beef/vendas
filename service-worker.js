const CACHE_NAME = "le-beef-painel-v6-0-5-1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1",
  "./access.css",
  "./sales.css?v=17",
  "./layout.css",
  "./dashboard.css?v=31",
  "./mobile-participants.css?v=27",
  "./participant-filter.css?v=15",
  "./filter-counter.css?v=9",
  "./branding.css?v=10",
  "./whatsapp.css?v=23",
  "./whatsapp-icon.png",
  "./pwa.css?v=7",
  "./financial-report.css?v=20",
  "./financial-settings.css?v=1",
  "./promoters.css?v=2",
  "./settlements.css?v=1",
  "./online-sales.css?v=1",
  "./auth-permissions.css?v=19",
  "./audit-log.css?v=27",
  "./payment-closing.css?v=28",
  "./event-access.css?v=18",
  "./toast-responsive.css?v=1",
  "./table-map.css?v=9",
  "./table-reservation-override.css?v=1",
  "./table-reservation-details.css?v=2",
  "./table-reservation-final.css?v=1",
  "./table-reservation-harmony.css?v=4",
  "./ticketing.css?v=11",
  "./ticket-config.css?v=6",
  "./excel-export.js?v=40",
  "./firebase-config.js",
  "./app.js?v=106",
  "./financial-core.js?v=2",
  "./pages.js?v=11",
  "./qr-scanner-tools.js?v=1",
  "./ticket-tools.js?v=10",
  "./thermal-print.js?v=10",
  "./ticket-layout.js?v=3",
  "./pages.css?v=5",
  "./event-archive.js?v=1",
  "./comprar.html",
  "./online-store.css?v=2",
  "./online-store.js?v=2",
  "./pwa.js",
  "./manifest.webmanifest",
  "./logo-le-beef.png",
  "./logo-le-beef-branca.png",
  "./icon-192.png?v=19",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./mesa-icon.png",
  "./bistro-icon.png",
  "./salao-fundo.png",
  "./mezanino-fundo.png"
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
