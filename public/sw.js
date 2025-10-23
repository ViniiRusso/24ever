// public/sw.js
// Service Worker simples: cache-first para /images/timeline/*
// Seed com primeiras 8 imagens; atualiza cache em background.

const SW_VERSION = 'v1';
const IMG_CACHE = `img-cache-${SW_VERSION}`;

// seed: adjust conforme seu total (aqui deixei as primeiras 8)
const SEED_IMAGES = Array.from({length: 8}, (_,i) => `/images/timeline/foto${i+1}.jpg`);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(IMG_CACHE)
      .then(cache => cache.addAll(SEED_IMAGES).catch(()=>{}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k.startsWith('img-cache-') && k !== IMG_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // intercepta apenas imagens dentro do mesmo origin e /images/timeline/
  if (url.origin === self.location.origin && url.pathname.startsWith('/images/timeline/')) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then(resp => {
          if (resp && resp.status === 200) {
            try { cache.put(req, resp.clone()); } catch (_) {}
          }
          return resp;
        }).catch(() => cached);

        // cache-first: retorna cache se existir, senão rede
        return cached || network;
      })
    );
  }
});