self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('zenmix-v5').then(c => c.addAll([
      '/', '/index.html', '/sw.js', '/manifest.json'
    ])).catch(() => {})
  );
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => r))
  );
});
