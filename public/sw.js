// ============================================
// Service Worker — PWA Cache & Offline Shell
// ============================================
const CACHE_NAME = 'fuelmap-v18';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/api.js',
    '/js/map.js',
    '/js/app.js',
    '/icon.svg',
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install: salva asset statici in cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: pulisce vecchie cache
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

// Fetch: Network-first per API, Cache-first per asset statici
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Le chiamate API vanno sempre via rete (dati in tempo reale)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response(JSON.stringify({ errore: 'Offline - impossibile caricare dati' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Asset statici: Network first con fallback su cache
    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            // Aggiorna la cache con la versione fresca
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
            });
            return networkResponse;
        }).catch(() => {
            // Offline: usa la cache
            return caches.match(event.request);
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
