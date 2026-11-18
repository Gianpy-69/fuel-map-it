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