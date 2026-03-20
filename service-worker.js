/* ============================================
   SERVICE WORKER - Offline & Performance
   Makes Simple Notes work without internet!
   ============================================ */

const CACHE_NAME = 'simple-notes-v3.2.0';
const OFFLINE_URL = '/Simple-Notes/';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/Simple-Notes/',
  '/Simple-Notes/index.html',
  '/Simple-Notes/css/base.css',
  '/Simple-Notes/css/layout.css',
  '/Simple-Notes/css/components.css',
  '/Simple-Notes/css/themes.css',
  '/Simple-Notes/css/responsive.css',
  '/Simple-Notes/css/auth.css',
  '/Simple-Notes/js/app.js',
  '/Simple-Notes/js/storage.js',
  '/Simple-Notes/js/privacy.js',
  '/Simple-Notes/js/utils/helpers.js',
  '/Simple-Notes/js/utils/security.js',
  '/Simple-Notes/js/ai/tagging.js',
  '/Simple-Notes/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((error) => console.error('[SW] Failed to cache assets:', error))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  // Skip external CDN requests (let them load normally)
  if (event.request.url.includes('cdnjs.cloudflare.com')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }

            // Clone and cache successful responses
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }

            return new Response('Offline - Simple Notes works without internet!', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
      })
  );
});

// Background sync for future features
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
});

// Push notifications for reminders (future feature)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body:    data.body || 'You have a reminder',
    icon:    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"%3E%3Crect fill="%23007AFF" width="192" height="192" rx="48"/%3E%3Ctext x="96" y="140" font-size="120" text-anchor="middle" fill="white"%3E📝%3C/text%3E%3C/svg%3E',
    badge:   'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Ccircle fill="%23007AFF" cx="48" cy="48" r="48"/%3E%3Ctext x="48" y="70" font-size="60" text-anchor="middle" fill="white"%3E📝%3C/text%3E%3C/svg%3E',
    vibrate: [200, 100, 200],
    data:    data,
    actions: [
      { action: 'open',    title: 'Open Note', icon: '' },
      { action: 'dismiss', title: 'Dismiss',   icon: '' }
    ],
    tag:                 'simple-notes-reminder',
    requireInteraction:  false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Simple Notes', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Message handler
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) =>
        Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
      )
    );
  }
});

// Placeholder for future background sync
async function syncNotes() {
  return Promise.resolve();
}

// Periodic background sync (future feature)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkReminders());
  }
});

// Placeholder for future reminder system
async function checkReminders() {
  return Promise.resolve();
}