const cacheName = "porsche-family-expenses-v52";
const files = [
  "./",
  "./index.html",
  "./styles.css?v=52",
  "./app.js?v=52",
  "./manifest.webmanifest",
  "./icon.svg",
  "./app-icon-192.png",
  "./app-icon-512.png",
  "./app-icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./family-porsche.jpg",
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
  // ไม่ยุ่งกับคำขอไปโดเมนอื่น (Google Sheets, ฟอนต์) — ไม่เก็บข้อมูลครอบครัวลง cache
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(cacheName);
        if (response.ok) cache.put(event.request, response.clone()).catch(() => {});
        return response;
      } catch (error) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
