/* ================================================
   SERVICE WORKER - Gestor de Tanda
   v4.3.1
   ================================================ */

const APP_VERSION = '4.3.1';
const CACHE_NAME = 'tanda-cache-v' + APP_VERSION;

// Archivos a cachear para offline
const ASSETS = [
    './',
    './index.html',
    './styles.css?v=4.3.1',
    './app.js?v=4.3.1',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
];

// ---- Instalar: cachear assets ----
self.addEventListener('install', event => {
    console.log('[SW v' + APP_VERSION + '] Instalando nuevo Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(
                ASSETS.map(url => cache.add(url).catch(err => console.warn('[SW] No se pudo cachear:', url, err)))
            );
        }).then(() => {
            console.log('[SW v' + APP_VERSION + '] Assets cacheados.');
        })
    );
});

// ---- Activar: limpiar caches anteriores inmediatamente ----
self.addEventListener('activate', event => {
    console.log('[SW v' + APP_VERSION + '] Activando y reclamando clientes...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Eliminando cache viejo: ' + key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ---- Fetch: Network-First para navegación, Stale-While-Revalidate para assets ----
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET') return;

    // 1. Navegación HTML: Network-first con fallback a caché (garantiza recibir la app actualizada)
    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match('./index.html').then(res => res || caches.match(event.request)))
        );
        return;
    }

    // 2. CDNs externas (Google Fonts, html2canvas): Network-first
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

    // 3. Assets locales (CSS, JS, iconos): Stale-while-revalidate
    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => { });

            return cached || networkFetch;
        })
    );
});

// ---- Mensajes: saltar espera cuando el usuario pide actualizar ----
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
        console.log('[SW] Recibido SKIP_WAITING, activando de inmediato...');
        self.skipWaiting();
    }
});
