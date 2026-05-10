const SW_VERSION = 'v4-edge-tts';
const CACHE_NAME = `zenmix-${SW_VERSION}`;

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/icon-192.png',
        '/icon-512.png',
      ]);
      await self.skipWaiting();
    })(),
  );
});

// ── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// ── Fetch: stale-while-revalidate (offline-first) ────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      const fetchAndCache = fetch(request)
        .then(async (response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, clone);
          }
          return response;
        })
        .catch(() => cached || new Response('Offline — no hay conexion.', { status: 408 }));

      return cached || fetchAndCache;
    })(),
  );
});
