/* Психограф — офлайн-кэш.
   Страницы: сеть в приоритете (свежие деплои), кэш — как фолбэк.
   Ассеты (css/js/шрифты/иконки): stale-while-revalidate. */
const CACHE = 'pg-v1';

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

  if (e.request.destination === 'document') {
    /* network-first: не показываем устаревшие страницы после деплоя */
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res.clone();
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  /* stale-while-revalidate для статики */
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
