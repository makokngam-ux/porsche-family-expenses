const cacheName = "porsche-family-expenses-v21";
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
  "./child-full-body.png",
  "./child-full-body-cutout.png",
  "./google-apps-script.gs",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(files)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
