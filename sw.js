const CACHE_NAME = 'news-v2';
const DATA_PATTERNS = [
  /\/data\/interpreted\//,
  /\/data\/themes\//,
  /\/data\/kiwoom\//,
  /\/data\/calendar\//,
];
const STATIC_ASSETS = [
  '/news.html',
  '/news.css',
  '/menu.js',
  '/js/utils.js',
  '/js/data-loader.js',
  '/js/calendar.js',
  '/js/renderer.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // JSON 데이터 — stale-while-revalidate
  if (DATA_PATTERNS.some(p => p.test(url.pathname))) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(response => {
          if (response.ok) {
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 정적 자산 — stale-while-revalidate (배포 시 즉시 갱신)
  if (STATIC_ASSETS.some(a => url.pathname === a || url.pathname.endsWith(a))) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(response => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 나머지 — network-first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
