'use strict';

const express = require('express');
const router = express.Router();

const pool = require('../db');
const { planPitStops } = require('../services/pitStopPlanner');

const VALID_FUELS = new Set([
    'benzina',
    'diesel',
    'gpl',
    'metano'
]);
const VALID_ROUTE_FUELS = new Set([
    ...VALID_FUELS,
    'tutte'
]);

const VALID_ROUTE_PREFERENCES = new Set([
    'tutte',
    'solo_autostrada',
    'risparmio'
]);

function parseFiniteNumber(value) {
    const number = Number.parseFloat(String(value));

    return Number.isFinite(number) ? number : null;
}

function isItalianCoordinate(lat, lon) {
    return (
        lat !== null &&
        lon !== null &&
        lat >= 35.5 &&
        lat <= 47.1 &&
        lon >= 6.6 &&
        lon <= 18.5
    );
}

// GET /api/distributori/vicini
router.get('/vicini', async (req, res) => {
    try {
        const lat = parseFiniteNumber(req.query.lat);
        const lon = parseFiniteNumber(req.query.lon);

        const parsedRadius = Number.parseInt(
            String(req.query.raggio ?? ''),
            10
        );

        const radius = Number.isFinite(parsedRadius)
            ? parsedRadius
            : 5000;

        const fuel =
            typeof req.query.carburante === 'string'
                ? req.query.carburante.trim().toLowerCase()
                : null;

        const onlyOpen = req.query.solo_aperti === 'true';

        const textQuery =
            typeof req.query.q === 'string'
                ? req.query.q.trim()
                : null;

        if (!isItalianCoordinate(lat, lon)) {
            return res.status(400).json({
                errore: 'Coordinate non valide o fuori dal territorio italiano'
            });
        }

        if (radius <= 0) {
            return res.status(400).json({
                errore: 'Il raggio deve essere maggiore di zero'
            });
        }

        const effectiveRadius = Math.min(radius, 50000);

        const whereClauses = [
            'd.nascosto = false',
            `
            ST_DWithin(
                d.posizione,
                ST_SetSRID(
                    ST_MakePoint($2, $1),
                    4326
                )::geography,
                $3
            )
            `
        ];

        const params = [
            lat,
            lon,
            effectiveRadius
        ];

        if (onlyOpen) {
            whereClauses.push(
                "(s.stato IS NULL OR s.stato <> 'chiuso')"
            );
        }

        if (fuel !== null && VALID_FUELS.has(fuel)) {
            whereClauses.push(
                `s.${fuel}_disponibile = true`
            );
        }

        if (textQuery !== null && textQuery.length > 0) {
            params.push(`%${textQuery}%`);

            const searchParameter = `$${params.length}`;

            whereClauses.push(`
                (
                    d.nome ILIKE ${searchParameter}
                    OR d.bandiera ILIKE ${searchParameter}
                    OR d.indirizzo ILIKE ${searchParameter}
                    OR d.comune ILIKE ${searchParameter}
                )
            `);
        }

        const querySql = `
            SELECT
                d.id,
                d.nome,
                d.indirizzo,
                d.comune,
                d.provincia,
                d.bandiera,
                d.autostradale,
                d.self_service,

                ST_Y(d.posizione::geometry) AS lat,
                ST_X(d.posizione::geometry) AS lon,

                ST_Distance(
                    d.posizione,
                    ST_SetSRID(
                        ST_MakePoint($2, $1),
                        4326
                    )::geography
                ) AS distanza_m,

                s.stato,
                s.benzina_disponibile,
                s.diesel_disponibile,
                s.gpl_disponibile,
                s.metano_disponibile,
                s.prezzo_benzina,
                s.prezzo_diesel,
                s.prezzo_gpl,
                s.prezzo_metano,
                s.livello_coda,
                s.conferme,
                s.ultimo_aggiornamento,

                (
                    SELECT su.dettagli->>'foto_url'
                    FROM segnalazioni_utenti su
                    WHERE su.distributore_id = d.id
                      AND su.dettagli->>'foto_url' IS NOT NULL
                    ORDER BY su.created_at DESC
                    LIMIT 1
                ) AS ultima_foto

            FROM distributori d
            LEFT JOIN stato_operativo s
                ON s.distributore_id = d.id

            WHERE ${whereClauses.join(' AND ')}

            ORDER BY distanza_m ASC
            LIMIT 150
        `;

        const result = await pool.query(querySql, params);

        return res.json({
            totale: result.rows.length,
            raggio_m: effectiveRadius,
            distributori: result.rows
        });
    } catch (error) {
        console.error(
            'Errore query distributori vicini:',
            error.message
        );

        return res.status(500).json({
            errore: 'Errore interno del server'
        });
    }
});

// GET /api/distributori/:id/storico
router.get('/:id/storico', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                errore: 'ID non valido'
            });
        }

        const result = await pool.query(
            `
            SELECT
                TO_CHAR(
                    data_rilevazione,
                    'YYYY-MM-DD'
                ) AS data,
                TO_CHAR(
                    data_rilevazione,
                    'Dy'
                ) AS giorno_settimana,
                prezzo_benzina,
                prezzo_diesel,
                prezzo_gpl,
                prezzo_metano
            FROM storico_prezzi
            WHERE distributore_id = $1
            ORDER BY data_rilevazione ASC
            LIMIT 14
            `,
            [id]
        );

        return res.json({
            distributore_id: id,
            storico: result.rows
        });
    } catch (error) {
        console.error(
            'Errore storico distributore:',
            error.message
        );

        return res.status(500).json({
            errore: 'Errore interno del server'
        });
    }
});

// GET /api/distributori/:id
router.get('/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                errore: 'ID non valido'
            });
        }

        const result = await pool.query(
            `
            SELECT
                d.id,
                d.nome,
                d.indirizzo,
                d.comune,
                d.provincia,
                d.bandiera,
                d.autostradale,
                d.self_service,

                ST_Y(d.posizione::geometry) AS lat,
                ST_X(d.posizione::geometry) AS lon,

                s.stato,
                s.benzina_disponibile,
                s.diesel_disponibile,
                s.gpl_disponibile,
                s.metano_disponibile,
                s.prezzo_benzina,
                s.prezzo_diesel,
                s.prezzo_gpl,
                s.prezzo_metano,
                s.livello_coda,
                s.conferme,
                s.ultimo_aggiornamento

            FROM distributori d
            LEFT JOIN stato_operativo s
                ON s.distributore_id = d.id

            WHERE d.id = $1
              AND d.nascosto = false
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                errore: 'Distributore non trovato'
            });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        console.error(
            'Errore dettaglio distributore:',
            error.message
        );

        return res.status(500).json({
            errore: 'Errore interno del server'
        });
    }
});

// POST /api/distributori/percorso
router.post('/percorso', async (req, res) => {
    try {
        const {
            geojson,
            carburante,
            autonomia_km: requestedAutonomyKm,
            buffer_m: requestedBuffer,
            preferenza: requestedPreference,
            includi_chiusi: requestedIncludeClosed
        } = req.body;

        if (
            !geojson ||
            geojson.type !== 'LineString' ||
            !Array.isArray(geojson.coordinates) ||
            geojson.coordinates.length < 2
        ) {
            return res.status(400).json({
                errore: 'Tracciato GeoJSON LineString non valido'
            });
        }

        const coordinatesAreValid = geojson.coordinates.every(
            (coordinate) => (
                Array.isArray(coordinate) &&
                coordinate.length >= 2 &&
                Number.isFinite(Number(coordinate[0])) &&
                Number.isFinite(Number(coordinate[1])) &&
                Number(coordinate[0]) >= -180 &&
                Number(coordinate[0]) <= 180 &&
                Number(coordinate[1]) >= -90 &&
                Number(coordinate[1]) <= 90
            )
        );

        if (!coordinatesAreValid) {
            return res.status(400).json({
                errore: 'Coordinate del tracciato non valide'
            });
        }

        const parsedBuffer = Number.parseInt(
            String(requestedBuffer ?? ''),
            10
        );

        const effectiveBuffer = Math.min(
            Math.max(
                Number.isFinite(parsedBuffer)
                    ? parsedBuffer
                    : 2500,
                500
            ),
            4000
        );

        const fuel =
            typeof carburante === 'string'
                ? carburante.trim().toLowerCase()
                : 'benzina';

        const preference =
            typeof requestedPreference === 'string'
                ? requestedPreference.trim().toLowerCase()
                : 'tutte';

        const autonomyKm = Number.parseFloat(
            String(requestedAutonomyKm ?? 250)
        );

        if (!VALID_ROUTE_FUELS.has(fuel)) {
            return res.status(400).json({
                errore: 'Tipo di carburante non valido'
            });
        }

        if (!VALID_ROUTE_PREFERENCES.has(preference)) {
            return res.status(400).json({
                errore: 'Preferenza percorso non valida'
            });
        }

        if (
            !Number.isFinite(autonomyKm) ||
            autonomyKm < 50 ||
            autonomyKm > 1500
        ) {
            return res.status(400).json({
                errore: 'autonomia_km deve essere compresa tra 50 e 1500 km'
            });
        }

        let fuelClause = '';
        let routeFuelPriceExpression = `s.prezzo_${fuel}`;
        let segmentOrderBy = `
            route_fuel_price ASC,
            autostradale DESC,
            progress_m ASC
        `;

        if (fuel === 'tutte') {
            const availableFuelClauses = [
                's.benzina_disponibile = true AND s.prezzo_benzina IS NOT NULL',
                's.diesel_disponibile = true AND s.prezzo_diesel IS NOT NULL',
                's.gpl_disponibile = true AND s.prezzo_gpl IS NOT NULL',
                's.metano_disponibile = true AND s.prezzo_metano IS NOT NULL'
            ];

            fuelClause = `AND (${availableFuelClauses.join(' OR ')})`;
            // Prezzi per carburanti diversi non sono confrontabili tra loro.
            routeFuelPriceExpression = 'NULL::numeric';
            segmentOrderBy = 'progress_m ASC, autostradale DESC';
        } else {
            fuelClause = `
                AND s.${fuel}_disponibile = true
                AND s.prezzo_${fuel} IS NOT NULL
            `;
        }

        const includeClosed = requestedIncludeClosed === true;
        const operatingStatusClause = includeClosed
            ? ''
            : "AND s.stato <> 'chiuso'";

        let preferenceClause = '';

        if (preference === 'solo_autostrada') {
            preferenceClause = 'AND d.autostradale = true';
        } else if (preference === 'risparmio') {
            preferenceClause = 'AND d.autostradale = false';
        }

        const querySql = `
            WITH route AS (
                SELECT
                    ST_SetSRID(
                        ST_GeomFromGeoJSON($1),
                        4326
                    ) AS geom
            ),
            route_metrics AS (
                SELECT
                    geom,
                    ST_Length(geom::geography) AS length_m
                FROM route
            ),
            station_candidates AS (
                SELECT
                    d.id,
                    d.nome,
                    d.indirizzo,
                    d.comune,
                    d.provincia,
                    d.bandiera,
                    d.autostradale,
                    d.self_service,

                    ST_Y(d.posizione::geometry) AS lat,
                    ST_X(d.posizione::geometry) AS lon,

                    s.stato,
                    s.benzina_disponibile,
                    s.diesel_disponibile,
                    s.gpl_disponibile,
                    s.metano_disponibile,
                    s.prezzo_benzina,
                    s.prezzo_diesel,
                    s.prezzo_gpl,
                    s.prezzo_metano,
                    s.livello_coda,
                    s.conferme,
                    s.ultimo_aggiornamento,

                    ROUND(
                        ST_Distance(
                            d.posizione,
                            route_metrics.geom::geography
                        )::numeric
                    ) AS dist_tracciato_m,

                    ROUND(
                        (
                            route_position.route_fraction * route_metrics.length_m
                        )::numeric
                    ) AS progress_m,

                    FLOOR(
                        route_position.route_fraction * route_metrics.length_m / 30000
                    )::int AS route_segment,

                    ${routeFuelPriceExpression} AS route_fuel_price

                FROM distributori d
                CROSS JOIN route_metrics
                CROSS JOIN LATERAL (
                    SELECT ST_LineLocatePoint(
                        route_metrics.geom,
                        d.posizione::geometry
                    ) AS route_fraction
                ) route_position
                INNER JOIN stato_operativo s
                    ON s.distributore_id = d.id

                WHERE d.nascosto = false
                  ${operatingStatusClause}
                  AND ST_DWithin(
                      d.posizione,
                      route_metrics.geom::geography,
                      $2
                  )
                  ${fuelClause}
                  ${preferenceClause}
            ),
            ranked_stations AS (
                SELECT
                    station_candidates.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY route_segment
                        ORDER BY ${segmentOrderBy}
                    ) AS segment_rank
                FROM station_candidates
            )
            SELECT
                id,
                nome,
                indirizzo,
                comune,
                provincia,
                bandiera,
                autostradale,
                self_service,
                lat,
                lon,
                stato,
                benzina_disponibile,
                diesel_disponibile,
                gpl_disponibile,
                metano_disponibile,
                prezzo_benzina,
                prezzo_diesel,
                prezzo_gpl,
                prezzo_metano,
                livello_coda,
                conferme,
                ultimo_aggiornamento,
                dist_tracciato_m,
                progress_m
            FROM ranked_stations
            WHERE segment_rank <= (
                SELECT CASE
                    WHEN length_m <= 300000 THEN 60
                    ELSE 5
                END
                FROM route_metrics
            )
            ORDER BY progress_m ASC, route_fuel_price ASC
        `;

        const result = await pool.query(querySql, [
            JSON.stringify(geojson),
            effectiveBuffer
        ]);

        const planner = fuel === 'tutte'
            ? null
            : planPitStops({
                stations: result.rows.filter(
                    (station) => station.stato !== 'chiuso'
                ),
                fuel,
                autonomyKm
            });

        return res.json({
            totale: result.rows.length,
            buffer_m: effectiveBuffer,
            autonomia_km: autonomyKm,
            distributori: result.rows,
            planner
        });
    } catch (error) {
        console.error(
            'Errore ricerca su percorso:',
            error.message
        );

        return res.status(500).json({
            errore: 'Errore durante la ricerca sul percorso'
        });
    }
});

module.exports = router;
