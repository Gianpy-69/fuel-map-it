// ============================================
// Service Worker — PWA Cache & Offline Shell
// ============================================
const CACHE_NAME = 'fuelmap-v25';
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
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/maplibre-gl@5.7.3/dist/maplibre-gl.css',
    'https://unpkg.com/maplibre-gl@5.7.3/dist/maplibre-gl.js',
    'https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install: salva asset statici in cache (tollerante ad errori singoli su CDN)
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
    // Il Cache Storage supporta solo richieste GET: ignora POST, PUT, DELETE
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Non mettere le tile dei provider mappa nella cache offline generica del service worker.
    if (url.hostname === 'tile.openstreetmap.org' || url.hostname.endsWith('.tile.openstreetmap.org') ||
        url.hostname === 'tiles.openfreemap.org' || url.hostname.endsWith('.tiles.openfreemap.org')) {
        return;
    }

    // Le chiamate API e Supabase vanno sempre via rete (fallback offline gestito in IndexedDB)
    if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
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

    // Asset statici: Network first con fallback su cache
    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clone);
                });
            }
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
