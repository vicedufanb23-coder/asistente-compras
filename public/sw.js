// ==========================================
// SERVICE WORKER — CALCULANDO TODO (PWA)
// Estrategia offline-first:
//  - Precache del shell de la app (rutas + manifest + iconos)
//  - Navegación: network-first con fallback a caché
//  - Assets estáticos: cache-first con relleno de caché
// ==========================================

const CACHE_VERSION = 'calculando-todo-v1';

// Rutas del shell de la app (todas prerenderizadas estáticas)
const PRECACHE_URLS = [
  '/',
  '/verduras',
  '/supermercado',
  '/actividades',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

// Instalación: precachear el shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar cachés viejas y tomar control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Intercepción de solicitudes
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET
  if (request.method !== 'GET') return;

  // Navegación: network-first, fallback a caché
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) =>
            cache.put(request, copy)
          );
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Assets estáticos (JS/CSS/imágenes/fuentes): cache-first + rellenar caché
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) =>
            cache.put(request, copy)
          );
        }
        return response;
      });
    })
  );
});