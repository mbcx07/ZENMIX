/**
 * ZENMIX v4 — Service Worker
 * Offline-first PWA with stale-while-revalidate + cache-first strategies.
 * @author Nothing Noty 🔥 | DataWarden 🗄️
 */

'use strict';

const CACHE_VERSION = `zenmix-v4-${Date.now()}`;

/** Assets to precache on install */
const PRECACHE_ASSETS = [
  '/',
  '/dw-index-v4.html',
  '/index.html',
  '/pf-styles-v4.css',
  '/nc-app-v4.js',
  '/nc-audio-v4.js',
  '/nc-data-v4.js',
  '/manifest.json'
];

// ─── INSTALL ──────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.debug('[SW:v4] Installing — precaching', PRECACHE_ASSETS.length, 'assets');

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Add all precached assets; ignore failures for individual files
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW:v4] Failed to precache:', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.debug('[SW:v4] Activating');

  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith('zenmix-') && name !== CACHE_VERSION)
          .map((stale) => {
            console.debug('[SW:v4] Deleting old cache:', stale);
            return caches.delete(stale);
          })
      )
    ).then(() => {
      // Claim all uncontrolled clients so SW controls immediately
      return self.clients.claim();
    })
  );
});

// ─── FETCH ────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ── Navigation: Stale-while-revalidate ──
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/dw-index-v4.html').then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => cached || caches.match('/index.html'));

        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── API calls: Network-first (must be fresh) ──
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) =>
          cached || new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'application/json' }
          })
        )
      )
    );
    return;
  }

  // ── Static assets: Cache-first with network fallback ──
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Update cache in background (stale-while-revalidate for assets)
        event.waitUntil(
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, networkResponse.clone()));
            }
          }).catch(() => { /* ignore network failures */ })
        );
        return cachedResponse;
      }

      // Not in cache — fetch from network
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || !networkResponse.ok) {
          return networkResponse;
        }
        const clone = networkResponse.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        return networkResponse;
      }).catch(() => {
        // Ultimate fallback for missing assets
        if (request.destination === 'document') {
          return caches.match('/dw-index-v4.html') || caches.match('/index.html');
        }
        return new Response('', { status: 408, statusText: 'Timeout — offline' });
      });
    })
  );
});

// ─── MESSAGE HANDLER — Daily reminder ─────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SCHEDULE_REMINDER') {
    scheduleReminder(event.data.hours || 20);
  }
});

/**
 * Schedule a daily notification.
 * @param {number} hours - Hour (0-23) to fire the reminder
 */
function scheduleReminder(hours) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hours, 0, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delayMs = target - now;

  setTimeout(() => {
    self.registration.showNotification('🧘 ZENMIX — Tu sesión diaria', {
      body: 'Es hora de tu sesión de hipnosis. Entra y relájate.',
      icon: '/manifest.json',
      tag: 'zenmix-daily',
      vibrate: [200, 100, 200],
      requireInteraction: false
    });
    // Reschedule for tomorrow
    scheduleReminder(hours);
  }, delayMs);
}
