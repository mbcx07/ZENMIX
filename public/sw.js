const CACHE = 'zenmix-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // API calls: network-first (they generate audio, must be fresh)
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('Offline', { status: 503, statusText: 'Offline' }))
    );
    return;
  }
  // App shell: cache-first
  e.respondWith(
    caches.match(e.request).then(r => {
      if (r) return r;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Daily session reminder notification
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_REMINDER') {
    const hours = e.data.hours || 20;
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    setTimeout(() => {
      self.registration.showNotification('🧘 ZENMIX — Tu sesión diaria', {
        body: 'Es hora de tu sesión de hipnosis. Entra y relájate.',
        icon: '/manifest.json',
        tag: 'zenmix-daily',
        vibrate: [200, 100, 200]
      });
    }, delay);
  }
});