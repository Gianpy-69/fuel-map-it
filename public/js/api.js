'use strict';

const isNativeApp = typeof window !== 'undefined' && (
    window.Capacitor !== undefined ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    window.location.hostname === 'localhost' && window.location.port === ''
);

// Cache offline persistente in IndexedDB per distributori e storico prezzi
const OfflineCache = {
    DB_NAME: 'fuelmap_offline_db',
    DB_VERSION: 1,
    MAX_STATIONS: 3000,
    _dbPromise: null,

    open() {
        if (typeof indexedDB === 'undefined') {
            return Promise.resolve(null);
        }
        if (this._dbPromise) return this._dbPromise;

        this._dbPromise = new Promise((resolve) => {
            try {
                const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('stations')) {
                        db.createObjectStore('stations', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('storico')) {
                        db.createObjectStore('storico', { keyPath: 'id' });
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
        return this._dbPromise;
    },

    haversineMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    async saveStations(stations) {
        if (!Array.isArray(stations) || stations.length === 0) return;
        const db = await this.open();
        if (!db) return;

        try {
            const tx = db.transaction('stations', 'readwrite');
            const store = tx.objectStore('stations');
            const now = Date.now();
            stations.forEach((s) => {
                if (s && s.id !== undefined && s.id !== null) {
                    store.put({ ...s, _cachedAt: now });
                }
            });

            // Mantieni il numero di record entro MAX_STATIONS
            const countReq = store.count();
            countReq.onsuccess = () => {
                if (countReq.result <= this.MAX_STATIONS) return;
                const getAllReq = store.getAll();
                getAllReq.onsuccess = () => {
                    const all = (getAllReq.result || []).sort(
                        (a, b) => (a._cachedAt || 0) - (b._cachedAt || 0)
                    );
                    const excess = all.length - this.MAX_STATIONS;
                    for (let i = 0; i < excess; i++) {
                        store.delete(all[i].id);
                    }
                };
            };
        } catch {
            // Ignora errori di quota o transazione
        }
    },

    async getNearbyStations(lat, lon, raggio = 10000, filters = {}) {
        const db = await this.open();
        if (!db) return { distributori: [], offline: true };

        return new Promise((resolve) => {
            try {
                const tx = db.transaction('stations', 'readonly');
                const store = tx.objectStore('stations');
                const req = store.getAll();

                req.onsuccess = () => {
                    const all = req.result || [];
                    const maxR = Math.min(Number(raggio) || 10000, 50000);
                    const fuel = filters.carburante ? String(filters.carburante).toLowerCase() : null;
                    const q = filters.q ? String(filters.q).trim().toLowerCase() : null;
                    let latestCache = 0;

                    const matched = [];
                    for (const s of all) {
                        const sLat = parseFloat(s.lat);
                        const sLon = parseFloat(s.lon);
                        if (!Number.isFinite(sLat) || !Number.isFinite(sLon)) continue;

                        const dist = this.haversineMeters(lat, lon, sLat, sLon);
                        if (dist > maxR) continue;

                        if (filters.soloAperti && s.stato === 'chiuso') continue;
                        if (fuel && ['benzina', 'diesel', 'gpl', 'metano'].includes(fuel)) {
                            if (s[`${fuel}_disponibile`] === false) continue;
                            if (s[`${fuel}_disponibile`] !== true && !s[`prezzo_${fuel}`]) continue;
                        }
                        if (q) {
                            const hay = `${s.nome || ''} ${s.bandiera || ''} ${s.indirizzo || ''} ${s.comune || ''}`.toLowerCase();
                            if (!hay.includes(q)) continue;
                        }

                        if ((s._cachedAt || 0) > latestCache) latestCache = s._cachedAt;
                        matched.push({ ...s, distanza_m: Math.round(dist) });
                    }

                    matched.sort((a, b) => a.distanza_m - b.distanza_m);
                    resolve({
                        distributori: matched.slice(0, 500),
                        offline: true,
                        cachedAt: latestCache || null
                    });
                };

                req.onerror = () => resolve({ distributori: [], offline: true });
            } catch {
                resolve({ distributori: [], offline: true });
            }
        });
    },

    async getStationById(id) {
        const db = await this.open();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction('stations', 'readonly');
                const store = tx.objectStore('stations');
                const numId = Number(id);
                const req = store.get(Number.isFinite(numId) ? numId : id);
                req.onsuccess = () => {
                    if (req.result) return resolve({ ...req.result, offline: true });
                    const reqStr = store.get(String(id));
                    reqStr.onsuccess = () => resolve(reqStr.result ? { ...reqStr.result, offline: true } : null);
                    reqStr.onerror = () => resolve(null);
                };
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    },

    async saveStorico(id, data) {
        if (!data) return;
        const db = await this.open();
        if (!db) return;
        try {
            const tx = db.transaction('storico', 'readwrite');
            tx.objectStore('storico').put({ id: String(id), data, _cachedAt: Date.now() });
        } catch {}
    },

    async getStorico(id) {
        const db = await this.open();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction('storico', 'readonly');
                const req = tx.objectStore('storico').get(String(id));
                req.onsuccess = () => resolve(req.result ? { ...req.result.data, offline: true } : null);
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }
};

const API = {
    baseUrl: isNativeApp ? 'https://fuel-map-it.onrender.com' : '',

    async getDistributoriVicini(
        lat,
        lon,
        raggio = 10000,
        filters = {}
    ) {
        const params = new URLSearchParams({
            lat: String(lat),
            lon: String(lon),
            raggio: String(raggio)
        });

        if (filters.carburante) {
            params.append(
                'carburante',
                String(filters.carburante)
            );
        }

        if (filters.soloAperti) {
            params.append('solo_aperti', 'true');
        }

        if (filters.q) {
            params.append('q', String(filters.q));
        }

        const url =
            `${this.baseUrl}/api/distributori/vicini?` +
            params.toString();

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Errore API: ${response.status}`);
            }
            const data = await response.json();
            if (Array.isArray(data?.distributori)) {
                OfflineCache.saveStations(data.distributori);
            }
            return data;
        } catch (err) {
            const cached = await OfflineCache.getNearbyStations(lat, lon, raggio, filters);
            if (cached.distributori.length > 0) {
                return cached;
            }
            throw err;
        }
    },

    async getDistributore(id) {
        try {
            const response = await fetch(
                `${this.baseUrl}/api/distributori/${id}`
            );
            if (!response.ok) {
                throw new Error(`Errore API: ${response.status}`);
            }
            const data = await response.json();
            if (data && data.id) {
                OfflineCache.saveStations([data]);
            }
            return data;
        } catch (err) {
            const cached = await OfflineCache.getStationById(id);
            if (cached) return cached;
            throw err;
        }
    },

    async getStoricoDistributore(id) {
        try {
            const response = await fetch(
                `${this.baseUrl}/api/distributori/${id}/storico`
            );
            if (!response.ok) {
                throw new Error(`Errore API: ${response.status}`);
            }
            const data = await response.json();
            if (data) {
                OfflineCache.saveStorico(id, data);
            }
            return data;
        } catch (err) {
            const cached = await OfflineCache.getStorico(id);
            if (cached) return cached;
            throw err;
        }
    },

    async getDistributoriSuPercorso(
        geojson,
        carburante = 'benzina',
        preferenza = 'tutte',
        autonomiaKm = 250
    ) {
        const payload = {
            geojson,
            carburante,
            preferenza,
            autonomia_km: autonomiaKm,
            buffer_m: 2500
        };

        const response = await fetch(
            `${this.baseUrl}/api/distributori/percorso`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        if (!response.ok) {
            let errorMessage =
                `Errore calcolo percorso: ${response.status}`;

            try {
                const errorBody = await response.json();

                if (
                    errorBody &&
                    typeof errorBody.errore === 'string'
                ) {
                    errorMessage = errorBody.errore;
                }
            } catch {
                // Mantiene il messaggio HTTP predefinito.
            }

            throw new Error(errorMessage);
        }

        return response.json();
    },

    async getSearchSuggestions(query) {
        const q = typeof query === 'string' ? query.trim() : '';
        if (q.length < 2) return [];

        try {
            const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&bbox=6.6,35.5,18.5,47.1`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Photon status ${res.status}`);
            const data = await res.json();

            if (!data || !Array.isArray(data.features)) return [];

            return data.features.map(f => {
                const p = f.properties || {};
                const coords = f.geometry?.coordinates || [];
                const subtitleParts = [p.street, p.city, p.state].filter(Boolean);
                const title = p.name || p.street || p.city || 'Luogo';
                const subtitle = subtitleParts.filter(s => s.toLowerCase() !== title.toLowerCase()).join(', ') || 'Italia';

                let icon = '📍';
                if (p.type === 'city') icon = '🏙️';
                else if (p.type === 'street') icon = '🛣️';

                return {
                    title,
                    subtitle,
                    icon,
                    lat: coords[1],
                    lon: coords[0]
                };
            }).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon));
        } catch (err) {
            try {
                const fallbackUrl = 'https://nominatim.openstreetmap.org/search?' +
                    new URLSearchParams({
                        format: 'jsonv2',
                        q: `${q}, Italia`,
                        limit: '5',
                        countrycodes: 'it',
                        addressdetails: '1'
                    }).toString();

                const resFallback = await fetch(fallbackUrl, {
                    headers: { Accept: 'application/json' }
                });
                const dataFallback = await resFallback.json();
                if (!Array.isArray(dataFallback)) return [];

                return dataFallback.map(item => {
                    const parts = (item.display_name || '').split(',');
                    return {
                        title: parts[0]?.trim() || item.name || 'Luogo',
                        subtitle: parts.slice(1, 3).map(s => s.trim()).join(', ') || 'Italia',
                        icon: '📍',
                        lat: parseFloat(item.lat),
                        lon: parseFloat(item.lon)
                    };
                }).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon));
            } catch (fallbackErr) {
                return [];
            }
        }
    },

    async geocode(query) {
        const normalizedQuery =
            typeof query === 'string'
                ? query.trim()
                : '';

        if (normalizedQuery.length < 2) {
            throw new Error(
                'Inserisci almeno due caratteri per la ricerca'
            );
        }

        const url =
            'https://nominatim.openstreetmap.org/search?' +
            new URLSearchParams({
                format: 'jsonv2',
                q: `${normalizedQuery}, Italia`,
                limit: '1',
                countrycodes: 'it',
                addressdetails: '1'
            }).toString();

        const response = await fetch(url, {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(
                'Errore durante la geocodifica della città'
            );
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error(
                `Città "${normalizedQuery}" non trovata`
            );
        }

        const firstResult = data[0];
        const latitude = Number.parseFloat(firstResult.lat);
        const longitude = Number.parseFloat(firstResult.lon);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            throw new Error(
                'Coordinate restituite non valide'
            );
        }

        return {
            lat: latitude,
            lon: longitude,
            nome: firstResult.display_name
        };
    },

    async getOsrmRoute(
        startLon,
        startLat,
        endLon,
        endLat
    ) {
        const coordinates = [
            [startLon, startLat],
            [endLon, endLat]
        ]
            .map(([longitude, latitude]) => (
                `${longitude},${latitude}`
            ))
            .join(';');

        const params = new URLSearchParams({
            overview: 'full',
            geometries: 'geojson',
            alternatives: 'false',
            steps: 'false'
        });

        const url =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${coordinates}?${params.toString()}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                'Impossibile tracciare il percorso stradale'
            );
        }

        const data = await response.json();

        if (
            !data ||
            data.code !== 'Ok' ||
            !Array.isArray(data.routes) ||
            data.routes.length === 0
        ) {
            throw new Error(
                'Nessuna rotta stradale trovata'
            );
        }

        return data.routes[0];
    },

    async inviaSegnalazione(data, file = null) {
        const sessionId = this.getSessionId();

        const headers = {
            'X-Session-Id': sessionId
        };

        let body;

        if (file instanceof File) {
            const formData = new FormData();

            formData.append(
                'distributore_id',
                String(data.distributore_id)
            );

            formData.append(
                'tipo_segnalazione',
                String(data.tipo_segnalazione)
            );

            formData.append(
                'dettagli',
                JSON.stringify(data.dettagli || {})
            );

            if (
                data.lat_utente !== null &&
                data.lat_utente !== undefined
            ) {
                formData.append(
                    'lat_utente',
                    String(data.lat_utente)
                );
            }

            if (
                data.lon_utente !== null &&
                data.lon_utente !== undefined
            ) {
                formData.append(
                    'lon_utente',
                    String(data.lon_utente)
                );
            }

            formData.append('foto', file);

            body = formData;
        } else {
            headers['Content-Type'] = 'application/json';

            body = JSON.stringify(data);
        }

        const response = await fetch(
            `${this.baseUrl}/api/segnalazioni`,
            {
                method: 'POST',
                headers,
                body
            }
        );

        if (!response.ok) {
            let errorMessage =
                `Errore invio segnalazione: ${response.status}`;

            try {
                const errorBody = await response.json();

                if (
                    errorBody &&
                    typeof errorBody.errore === 'string'
                ) {
                    errorMessage = errorBody.errore;
                }
            } catch {
                // Mantiene il messaggio HTTP predefinito.
            }

            throw new Error(errorMessage);
        }

        return response.json();
    },

    async inviaFeedback(messaggio, email = null) {
        const sessionId = this.getSessionId();
        const response = await fetch(`${this.baseUrl}/api/segnalazioni/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                messaggio,
                email,
                app_version: '1.0.0'
            })
        });

        if (!response.ok) {
            let errorMessage = `Errore invio feedback: ${response.status}`;
            try {
                const errBody = await response.json();
                if (errBody && errBody.errore) errorMessage = errBody.errore;
            } catch {}
            throw new Error(errorMessage);
        }

        return response.json();
    },

    getSessionId() {
        const storageKey = 'fuelmap_session';

        let sessionId = localStorage.getItem(storageKey);

        if (
            typeof sessionId !== 'string' ||
            sessionId.length === 0
        ) {
            sessionId = crypto.randomUUID();
            localStorage.setItem(storageKey, sessionId);
        }

        return sessionId;
    }
};

window.API = API;