// ============================================
// Service Worker — PWA Cache & Offline Shell
// ============================================
const CACHE_NAME = 'fuelmap-v36';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/404.html',
    '/privacy.html',
    '/css/style.css',
    '/js/api.js',
    '/js/map.js',
    '/js/app.js',
    '/icon.svg',
    '/icon-192.png',
    '/icon-512.png',
    '/manifest.json'
];

// Install: salva gli asset locali principali in cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                STATIC_ASSETS.map((url) => cache.add(url))
            );
        })
    );
    self.skipWaiting();
});

// Activate: pulisce tutte le vecchie cache (es. fuelmap-v35 e precedenti)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: gestisce solo richieste same-origin GET per evitare blocchi CSP/CDN
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Lascia gestire al browser le risorse di terze parti (CDN unpkg, MapLibre tiles, Analytics, font)
    // evitando qualsiasi interferenza CSP o risposte opaque al refresh della pagina.
    if (url.origin !== self.location.origin || url.pathname === '/sw.js') {
        return;
    }

    // Le chiamate API vanno sempre via rete (fallback offline gestito in IndexedDB)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response(JSON.stringify({ errore: 'Offline - impossibile caricare dati' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Asset statici same-origin: Network first con fallback sicuro su cache
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone).catch(() => {});
                    });
                }
                return networkResponse;
            })
            .catch(async () => {
                const cached = await caches.match(event.request);
                if (cached) return cached;
                if (event.request.mode === 'navigate') {
                    const fallbackPage = await caches.match('/index.html');
                    if (fallbackPage) return fallbackPage;
                }
                return Response.error();
            })
    );
});

// ============================================
// Click su Notifica di Sistema / Push
// ============================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    if (data.stationId) {
                        client.postMessage({
                            type: 'OPEN_STATION_FROM_NOTIFICATION',
                            stationId: data.stationId
                        });
                    }
                    return;
                }
            }
            if (clients.openWindow) {
                const targetUrl = data.stationId ? `/?station=${data.stationId}` : '/';
                return clients.openWindow(targetUrl);
            }
        })
    );
});
