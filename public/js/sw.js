// SW minimalista: só cacheia /images/** (jpg/png/webp/gif/svg) com stale-while-revalidate
const CACHE = '24ever-imgs-v1';
const IMG_RE = /^\/images\/.+\.(?:jpg|jpeg|png|webp|gif|svg)$/i;

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (!IMG_RE.test(url.pathname)) return; // só imagens

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request, { ignoreVary: true });
    const fetchPromise = fetch(e.request, { cache: 'no-store' })
      .then(resp => {
        if (resp && resp.ok) cache.put(e.request, resp.clone());
        return resp;
      })
      .catch(() => cached || Response.error());

    // stale-while-revalidate: retorna rápido se tiver cache, atualiza ao fundo
    return cached || fetchPromise;
  })());
});