'use strict';

const isNativeApp = typeof window !== 'undefined' && (
    window.Capacitor !== undefined ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    window.location.hostname === 'localhost' && window.location.port === ''
);

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

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Errore API: ${response.status}`
            );
        }

        return response.json();
    },

    async getDistributore(id) {
        const response = await fetch(
            `${this.baseUrl}/api/distributori/${id}`
        );

        if (!response.ok) {
            throw new Error(
                `Errore API: ${response.status}`
            );
        }

        return response.json();
    },

    async getStoricoDistributore(id) {
        const response = await fetch(
            `${this.baseUrl}/api/distributori/${id}/storico`
        );

        if (!response.ok) {
            throw new Error(
                `Errore API: ${response.status}`
            );
        }

        return response.json();
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