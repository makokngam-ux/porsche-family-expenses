const cacheName = "porsche-family-expenses-v25";
const files = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./app-icon-192.png",
  "./app-icon-512.png",
  "./app-icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./family-porsche.jpg",
  "./google-apps-script.gs",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(files)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

// network-first: โหลดไฟล์ล่าสุดจากเน็ตเสมอเมื่อออนไลน์ แล้วค่อย fallback ไป cache ตอนออฟไลน์
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(cacheName);
        cache.put(event.request, response.clone()).catch(() => {});
        return response;
      } catch (error) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
