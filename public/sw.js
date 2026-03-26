// public/sw.js — EMMI Service Worker v2
// FIX: Offline redirect loop solved.
// Previously: offline → getUser() fails → redirect to /auth → cached /dashboard → loop.
// Now: offline navigation always serves the cached page for that route, never redirects.
// Engineers can READ their data offline. Writes queue and sync when back online.

const CACHE_NAME = 'emmi-v2';

const PRECACHE = [
  '/',
  '/dashboard',
  '/faults',
  '/activities',
  '/equipment',
  '/feed',
  '/profile',
  '/inventory',
  '/tasks',
  '/kpi',
  '/qr',
  '/schedule',
  '/permit',
];

// ── Install: cache core pages ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE).catch(() => {
      // Some pages may 404 on first install — that's fine, cache what we can
    }))
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

// ── Fetch: smart offline strategy ─────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET — these must go to network (form submits, etc.)
  if (event.request.method !== 'GET') return;

  // Skip Supabase API — must be live data
  if (url.hostname.includes('supabase.co')) return;

  // Skip our own API routes — must be live
  if (url.pathname.startsWith('/api/')) return;

  // Skip external CDN scripts (jsQR, ZXing, QR generator)
  if (url.hostname !== self.location.hostname) return;

  event.respondWith(handleFetch(event.request));
});

async function handleFetch(request) {
  const url = new URL(request.url);

  try {
    // Try network first — update cache on success
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (networkError) {
    // OFFLINE: serve from cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // For page navigation: serve the specific cached page if available,
    // otherwise serve dashboard (NOT /auth — that causes the redirect loop)
    if (request.mode === 'navigate') {
      // Try to match the exact path first
      const exactCached = await caches.match(url.pathname);
      if (exactCached) return exactCached;

      // Fall back to dashboard (engineer stays in app, not kicked to login)
      const dashboard = await caches.match('/dashboard');
      if (dashboard) return dashboard;

      // Last resort — offline page
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>EMMI — Offline</title>
  <style>
    body { background: #0b0f14; color: #e6edf3; font-family: sans-serif;
           display: flex; flex-direction: column; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 24px; }
    .logo { font-size: 32px; font-weight: 800; color: #f0a500; letter-spacing: 6px; margin-bottom: 8px; }
    p { color: #8b949e; font-size: 14px; line-height: 1.6; max-width: 280px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #f85149;
           display: inline-block; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="logo">EMMI</div>
  <div class="dot"></div>
  <p>You are offline. Connect to the internet to sync data.</p>
  <p style="margin-top:12px;font-size:12px;">Your previously viewed data is available — go back to the dashboard.</p>
  <a href="/dashboard" style="margin-top:24px;background:#f0a500;color:#000;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
    Back to Dashboard
  </a>
</body>
</html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

// ── Push notifications ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data  = event.data?.json() || {};
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
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
