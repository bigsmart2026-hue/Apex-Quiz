const VERSION = 'v2';
const SHELL_CACHE = `apex-quiz-shell-${VERSION}`;
const ASSET_CACHE = `apex-quiz-assets-${VERSION}`;
const OFFLINE_URL = '/index.html';

const SHELL_ASSETS = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/logo-emblem-64.png',
  '/logo-emblem-192.png',
  '/logo-emblem-512.png',
  '/logo-maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key))
  );
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put('/', response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return (
      (await cache.match('/', { ignoreSearch: true })) ||
      (await cache.match(OFFLINE_URL)) ||
      new Response(
        '<!doctype html><title>Offline</title><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>Apex Quiz is offline</h1><p>Reconnect to keep playing.</p></body>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    );
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  event.waitUntil(network.then(() => trimCache(ASSET_CACHE, 80)).catch(() => {}));
  return cached || (await network) || Response.error();
}

async function networkFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (
    ['style', 'script', 'image', 'font', 'manifest'].includes(request.destination) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  event.respondWith(networkFirst(request));
});
