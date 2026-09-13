// Savannah offline shell. Bump CACHE when shipping cached files.
const CACHE = 'savannah-v2';
const SHELL = ['/manifest.webmanifest', '/icon.svg', '/pwa-192x192.png', '/pwa-512x512.png', '/apple-touch-icon.png', '/brand/7d-logo.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || e.request.method !== 'GET') return; // never cache the token or the page nonce
  if (e.request.mode === 'navigate') return; // the HTML carries a fresh nonce each load
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && res.type === 'basic' && /\.(png|svg|json|js|css|woff2?)$/.test(url.pathname)) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    })),
  );
});
