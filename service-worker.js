/* ============================================================
   SERVICE WORKER — Wren
   Offline support & asset caching
   ============================================================ */

const CACHE_NAME  = 'wren-v1.0.0';
const OFFLINE_URL = '/Simple-Notes/';

const STATIC_ASSETS = [
  '/Simple-Notes/',
  '/Simple-Notes/index.html',
  '/Simple-Notes/css/base.css',
  '/Simple-Notes/css/layout.css',
  '/Simple-Notes/css/components.css',
  '/Simple-Notes/css/themes.css',
  '/Simple-Notes/css/responsive.css',
  '/Simple-Notes/css/phase1.css',
  '/Simple-Notes/css/phase3.css',
  '/Simple-Notes/js/app.js',
  '/Simple-Notes/js/storage.js',
  '/Simple-Notes/js/privacy.js',
  '/Simple-Notes/js/utils/helpers.js',
  '/Simple-Notes/js/utils/security.js',
  '/Simple-Notes/js/search.js',
  '/Simple-Notes/js/settings.js',
  '/Simple-Notes/js/app-phase1-patch.js',
  '/Simple-Notes/js/contacts.js',
  '/Simple-Notes/js/share.js',
  '/Simple-Notes/js/wren-rebrand.js',
  '/Simple-Notes/manifest.json'
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[Wren SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => {
        console.log('[Wren SW] ✅ Assets cached');
        return self.skipWaiting();
      })
      .catch(err => console.error('[Wren SW] ❌ Cache failed:', err))
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[Wren SW] Activating…');
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(n => n !== CACHE_NAME)
          .map(n => { console.log('[Wren SW] Removing old cache:', n); return caches.delete(n); })
      ))
      .then(() => {
        console.log('[Wren SW] ✅ Activated');
        return self.clients.claim();
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  if (event.request.url.includes('cdnjs.cloudflare.com')) return; // CDN → network only

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        console.log('[Wren SW] 📦 Cache hit:', event.request.url);
        return cached;
      }
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('Wren works offline — check back shortly.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
    })
  );
});

// ── Messages ──────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
    );
  }
});

// ── Push notifications ────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body:    data.body || 'You have a reminder from Wren',
    icon:    `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%23007AFF' width='192' height='192' rx='48'/><text x='96' y='140' font-size='120' text-anchor='middle' fill='white'>🐦</text></svg>`,
    vibrate: [200, 100, 200],
    data:    data,
    tag:     'wren-reminder',
    actions: [
      { action: 'open',    title: 'Open Wren' },
      { action: 'dismiss', title: 'Dismiss'   }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Wren', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open') {
    event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
  }
});

console.log('[Wren SW] ✅ Service worker ready');
