/* ================================================
   SERVICE WORKER - Gestor de Tanda
   v1.0.0
   ================================================ */

const APP_VERSION = '1.0.0';
const CACHE_NAME = `tanda-cache-v${APP_VERSION}`;

// Archivos a cachear
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
];

// ---- Instalar: cachear todos los assets ----
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log(`[SW v${APP_VERSION}] Cacheando assets...`);
            // Cachear uno a uno para no fallar si alguno externo falla
            return Promise.allSettled(
                ASSETS.map(url => cache.add(url).catch(err => console.warn('[SW] No se pudo cachear:', url, err)))
            );
        }).then(() => self.skipWaiting())
    );
});

// ---- Activar: eliminar caches viejos ----
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log(`[SW] Eliminando cache viejo: ${key}`);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ---- Fetch: Cache-first para assets locales, Network-first para externas ----
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Solo manejar GET
    if (event.request.method !== 'GET') return;

    // Network-first para fuentes e CDN externos
    if (url.origin !== location.origin) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first para assets locales
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            });
        })
    );
});

// ---- Recibir mensaje de actualización forzada ----
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
