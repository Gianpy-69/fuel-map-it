'use strict';

const FUEL_KEYS = Object.freeze({
    benzina: {
        availability: 'benzina_disponibile',
        price: 'prezzo_benzina'
    },
    diesel: {
        availability: 'diesel_disponibile',
        price: 'prezzo_diesel'
    },
    gpl: {
        availability: 'gpl_disponibile',
        price: 'prezzo_gpl'
    },
    metano: {
        availability: 'metano_disponibile',
        price: 'prezzo_metano'
    }
});

const DEFAULT_OPTIONS = Object.freeze({
    safeWindowStartOffsetKm: 80,
    reserveBufferKm: 10,
    maxResults: 3
});

function toFiniteNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function normalizeFuel(fuel) {
    if (typeof fuel !== 'string') {
        return null;
    }

    const normalizedFuel = fuel.trim().toLowerCase();

    return Object.prototype.hasOwnProperty.call(
        FUEL_KEYS,
        normalizedFuel
    )
        ? normalizedFuel
        : null;
}

function getFuelData(station, fuel) {
    const fuelConfig = FUEL_KEYS[fuel];

    if (!fuelConfig) {
        return null;
    }

    const availability = station[fuelConfig.availability];
    const price = toFiniteNumber(station[fuelConfig.price]);

    if (availability !== true || price === null || price <= 0) {
        return null;
    }

    return {
        price
    };
}

function calculateSafeWindow(autonomyKm, options) {
    const startKm = Math.max(
        0,
        autonomyKm - options.safeWindowStartOffsetKm
    );

    const endKm = Math.max(
        startKm,
        autonomyKm - options.reserveBufferKm
    );

    return {
        startKm,
        endKm
    };
}

function calculateStationScore(station, fuelData, safeWindow) {
    const progressKm = station.progress_m / 1000;

    const isInsideSafeWindow =
        progressKm >= safeWindow.startKm &&
        progressKm <= safeWindow.endKm;

    const distanceFromSafeWindow = isInsideSafeWindow
        ? 0
        : Math.min(
            Math.abs(progressKm - safeWindow.startKm),
            Math.abs(progressKm - safeWindow.endKm)
        );

    const queueLevel = toFiniteNumber(station.livello_coda) ?? 0;
    const queuePenalty = queueLevel * 2;
    const pricePenalty = fuelData.price * 10;

    const score =
        (isInsideSafeWindow ? 1000 : 0) -
        distanceFromSafeWindow * 5 -
        pricePenalty -
        queuePenalty;

    return {
        isInsideSafeWindow,
        distanceFromSafeWindow,
        score
    };
}

function planPitStops(input) {
    if (
        input === null ||
        typeof input !== 'object' ||
        !Array.isArray(input.stations)
    ) {
        throw new TypeError(
            'stations deve essere un array'
        );
    }

    const fuel = normalizeFuel(input.fuel);

    if (fuel === null) {
        throw new TypeError(
            'fuel deve essere benzina, diesel, gpl oppure metano'
        );
    }

    const autonomyKm = toFiniteNumber(input.autonomyKm);

    if (
        autonomyKm === null ||
        autonomyKm < 50 ||
        autonomyKm > 1500
    ) {
        throw new RangeError(
            'autonomyKm deve essere compresa tra 50 e 1500 km'
        );
    }

    const options = {
        ...DEFAULT_OPTIONS,
        ...(input.options || {})
    };

    const safeWindow = calculateSafeWindow(
        autonomyKm,
        options
    );

    const candidates = input.stations
        .map((station) => {
            const progressMeters = toFiniteNumber(
                station.progress_m
            );

            if (
                progressMeters === null ||
                progressMeters < 0
            ) {
                return null;
            }

            const fuelData = getFuelData(
                station,
                fuel
            );

            if (fuelData === null) {
                return null;
            }

            const score = calculateStationScore(
                {
                    ...station,
                    progress_m: progressMeters
                },
                fuelData,
                safeWindow
            );

            return {
                ...station,
                fuel,
                fuel_price: fuelData.price,
                progress_km: Number(
                    (progressMeters / 1000).toFixed(1)
                ),
                safe_zone: score.isInsideSafeWindow,
                distance_from_safe_zone_km: Number(
                    score.distanceFromSafeWindow.toFixed(1)
                ),
                planner_score: Number(
                    score.score.toFixed(2)
                )
            };
        })
        .filter((station) => station !== null)
        .sort((firstStation, secondStation) => {
            if (
                secondStation.safe_zone !==
                firstStation.safe_zone
            ) {
                return (
                    Number(secondStation.safe_zone) -
                    Number(firstStation.safe_zone)
                );
            }

            if (
                secondStation.planner_score !==
                firstStation.planner_score
            ) {
                return (
                    secondStation.planner_score -
                    firstStation.planner_score
                );
            }

            return (
                firstStation.fuel_price -
                secondStation.fuel_price
            );
        });

    const recommendations = candidates
        .slice(0, options.maxResults)
        .map((station, index) => ({
            ...station,
            rank: index + 1,
            reason: station.safe_zone
                ? 'Nella finestra sicura di rifornimento'
                : 'Alternativa vicina alla finestra sicura'
        }));

    return {
        window: {
            start_km: safeWindow.startKm,
            end_km: safeWindow.endKm
        },
        candidates,
        recommendations
    };
}

module.exports = {
    planPitStops
};