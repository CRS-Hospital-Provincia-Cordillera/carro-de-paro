/* ================================================================
   Service Worker — Carro de Paro Digital (CRS Hospital Provincia Cordillera)

   Estrategia deliberada:
   - HTML / navegación: NETWORK-FIRST. Si hay conexión, SIEMPRE se sirve
     la versión más reciente (y se actualiza la caché). Solo si la red
     falla (sin conexión) se sirve la copia cacheada.
     Motivo de seguridad: esta app muestra dosis de medicamentos de
     emergencia. Una estrategia "cache-first" podría mostrar dosis
     desactualizadas sin que el usuario lo note tras una actualización
     de datos. "Network-first" minimiza ese riesgo mientras haya conexión,
     y el banner de actualización avisa cuando se detecta una versión nueva.
   - Assets estáticos (imágenes, manifest): CACHE-FIRST, con actualización
     en segundo plano.

   CACHE_NAME está ligado a la versión/fecha: cambiar este valor en cada
   actualización de datos clínicos fuerza la invalidación de la caché
   antigua en todos los dispositivos.
   ================================================================ */

const CACHE_NAME = 'carro-paro-v5-2026-09';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './Logo-CRS.png',
  './PARA.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    // Network-first: la fuente de verdad es la red mientras haya conexión.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first para assets estáticos (imágenes, manifest, etc).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => cached);
    })
  );
});
