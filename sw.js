/* Психограф — офлайн-кэш.
   Страницы, CSS и JS: сеть в приоритете (деплои видны сразу), кэш — фолбэк.
   Тяжёлая статика (шрифты, изображения, vendor): stale-while-revalidate. */
const CACHE = 'pg-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  const dest = e.request.destination;
  const networkFirst = dest === 'document' || dest === 'style' || dest === 'script' || dest === 'manifest';

  if (networkFirst) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  /* stale-while-revalidate для шрифтов/картинок/vendor */
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const cached = await c.match(e.request);
      const network = fetch(e.request)
        .then(res => {
          if (res.ok) c.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
