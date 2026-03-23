// public/sw.js — EMMI Service Worker
// Caches key pages so the app works when internet drops.
// Engineers can still READ their faults, equipment and activities offline.
// New data syncs automatically when connection returns.

const CACHE_NAME = 'emmi-v1';

// Pages to cache immediately on install
const PRECACHE = [
  '/',
  '/dashboard',
  '/faults',
  '/activities',
  '/equipment',
  '/feed',
  '/profile',
];

// ── Install: cache core pages ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network first, fall back to cache ───────────────────
// For API/Supabase calls: always try network (live data matters).
// For pages: try network first, serve cache if offline.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and Supabase API calls — always live
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.pathname.startsWith('/api/')) return;

  // For everything else: network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // If navigating to a page not in cache, serve dashboard from cache
          if (event.request.mode === 'navigate') {
            return caches.match('/dashboard');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ── Push notifications ─────────────────────────────────────────
// Handles push notifications sent from the server even when app is closed.
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'EMMI — New Update';
  const body  = data.body  || 'A colleague has posted on the plant feed.';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      tag:   data.tag || 'emmi-notification',
      data:  { url: data.url || '/feed' },
      requireInteraction: true,
    })
  );
});

// ── Notification click → open the app ─────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/feed';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
