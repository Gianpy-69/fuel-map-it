// ============================================
// Mappa Leaflet – gestione marker e interazioni
// ============================================

const FuelMap = {
    map: null,
    markers: [],
    clusterGroup: null,
    userMarker: null,
    userAccuracyCircle: null,
    userLat: null,
    userLon: null,
    
    streetLayer: null,
    streetLayerStyle: null,
    satelliteLayer: null,
    satelliteLabelsLayer: null,

    isSatellite: false,
    isDarkMode: false,

    init() {
        // Mappa stradale vettoriale OpenFreeMap (dati OSM, resa con MapLibre).
        this.streetLayerStyle = this.isDarkMode
            ? 'https://tiles.openfreemap.org/styles/dark'
            : 'https://tiles.openfreemap.org/styles/liberty';
        this.streetLayer = L.maplibreGL({
            style: this.streetLayerStyle,
            maxZoom: 19,
            attributionControl: false
        });

        // Layer Satellite Esri World Imagery
        this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 19
        });

        // Etichette strade per il satellite
        this.satelliteLabelsLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19
        });

        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: true,
            maxZoom: 19,
            layers: [this.streetLayer]
        }).setView([41.9028, 12.4964], 13);

        this.map.attributionControl.addAttribution(
            '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> · Dati da <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        );

        L.control.zoom({ position: 'bottomright' }).addTo(this.map);

        // Inizializzazione Gruppo Cluster ad alte prestazioni
        if (typeof L.markerClusterGroup === 'function') {
            this.clusterGroup = L.markerClusterGroup({
                maxClusterRadius: 40,
                showCoverageOnHover: false,
                spiderfyOnMaxZoom: true,
                animate: true,
                iconCreateFunction: (cluster) => {
                    const count = cluster.getChildCount();
                    let sizeClass = 'cluster-sm';
                    if (count >= 15) sizeClass = 'cluster-md';
                    if (count >= 40) sizeClass = 'cluster-lg';
                    return L.divIcon({
                        html: `<div class="fuel-cluster-icon ${sizeClass}"><span>${count}</span></div>`,
                        className: '',
                        iconSize: [38, 38],
                        iconAnchor: [19, 19]
                    });
                }
            });
            this.map.addLayer(this.clusterGroup);
        }

        this.map.on('moveend', () => {
            if (window.App && typeof window.App.onMapMoved === 'function') {
                window.App.onMapMoved();
            }
        });
    },

    getCenterAndRadius() {
        const center = this.map.getCenter();
        const bounds = this.map.getBounds();
        const radiusMeters = center.distanceTo(bounds.getNorthEast());
        const zoom = this.map.getZoom();

        return {
            lat: center.lat,
            lon: center.lng,
            radius: Math.min(Math.round(radiusMeters), 30000),
            zoom
        };
    },

    createMarkerIcon(d, isCheapest = false, fuelFilter = null) {
        let price = null;
        if (fuelFilter && d[`prezzo_${fuelFilter}`]) {
            price = d[`prezzo_${fuelFilter}`];
        } else {
            price = d.prezzo_benzina || d.prezzo_diesel || d.prezzo_gpl || d.prezzo_metano;
        }

        const priceText = (price && parseFloat(price) > 0) 
            ? `${parseFloat(price).toFixed(3)} €` 
            : '⛽';
            
        const stato = d.stato || 'sconosciuto';
        const isPitStop = Boolean(d.isRecommendedPitStop);
        const crownHtml = isCheapest 
            ? '<div class="pin-crown">👑</div>' 
            : (isPitStop ? '<div class="pin-crown pin-crown-pitstop" title="Tappa sosta consigliata">🎯</div>' : '');
        const highwayTag = d.autostradale ? '<span class="pin-highway-badge" title="Area di Servizio Autostradale">🛣️</span>' : '';

        const width = d.autostradale ? 80 : 66;
        const pitstopClass = isPitStop ? 'pin-pitstop-highlight' : '';

        return L.divIcon({
            className: 'custom-pin-wrap',
            html: `
                <div class="fuel-price-pin ${isCheapest ? 'pin-cheapest' : ''} ${pitstopClass} ${d.autostradale ? 'pin-highway' : ''} pin-status-${stato}">
                    ${crownHtml}
                    ${highwayTag}
                    <span class="pin-status-dot"></span>
                    <span class="pin-price-val">${priceText}</span>
                    <div class="pin-tail"></div>
                </div>
            `,
            iconSize: [width, 30],
            iconAnchor: [width / 2, 30],
            popupAnchor: [0, -32]
        });
    },

    renderDistributori(distributori, cheapestId = null, fuelFilter = null) {
        if (this.clusterGroup) {
            this.clusterGroup.clearLayers();
        } else {
            this.markers.forEach(m => this.map.removeLayer(m));
        }
        this.markers = [];
        const newMarkers = [];

        distributori.forEach(d => {
            const isCheapest = d.id === cheapestId;
            const icon = this.createMarkerIcon(d, isCheapest, fuelFilter);
            
            const marker = L.marker([d.lat, d.lon], { icon });

            marker.on('click', () => {
                App.openSheet(d, isCheapest);
            });

            marker.distributoreData = d;
            newMarkers.push(marker);
            this.markers.push(marker);
        });

        if (this.clusterGroup) {
            this.clusterGroup.addLayers(newMarkers);
        } else {
            newMarkers.forEach(m => m.addTo(this.map));
        }
    },

    setUserPosition(lat, lon) {
        this.userLat = lat;
        this.userLon = lon;

        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }
        if (this.userAccuracyCircle) {
            this.map.removeLayer(this.userAccuracyCircle);
        }

        this.userMarker = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: '#0066FF',
            fillOpacity: 1,
            color: 'white',
            weight: 3
        }).addTo(this.map);

        this.userAccuracyCircle = L.circle([lat, lon], {
            radius: 50,
            fillColor: '#0066FF',
            fillOpacity: 0.08,
            color: '#0066FF',
            weight: 1,
            opacity: 0.3
        }).addTo(this.map);
    },

    flyTo(lat, lon, zoom = 15) {
        this.map.flyTo([lat, lon], zoom, { duration: 1 });
    },

    updateStreetStyle() {
        const style = this.isDarkMode
            ? 'https://tiles.openfreemap.org/styles/dark'
            : 'https://tiles.openfreemap.org/styles/liberty';

        if (this.streetLayerStyle === style) return;
        this.streetLayerStyle = style;
        if (!this.streetLayer) return;

        this.streetLayer.options.style = style;
        if (this.map && this.map.hasLayer(this.streetLayer)) {
            const glMap = this.streetLayer.getMaplibreMap();
            if (glMap) glMap.setStyle(style);
        }
    },

    updateBaseLayer() {
        this.updateStreetStyle();

        if (this.isSatellite) {
            // Rimuovi mappa stradale
            if (this.map.hasLayer(this.streetLayer)) this.map.removeLayer(this.streetLayer);
            // Aggiungi satellite + etichette
            if (!this.map.hasLayer(this.satelliteLayer)) this.map.addLayer(this.satelliteLayer);
            if (!this.map.hasLayer(this.satelliteLabelsLayer)) this.map.addLayer(this.satelliteLabelsLayer);
        } else {
            // Rimuovi satellite + etichette
            if (this.map.hasLayer(this.satelliteLayer)) this.map.removeLayer(this.satelliteLayer);
            if (this.map.hasLayer(this.satelliteLabelsLayer)) this.map.removeLayer(this.satelliteLabelsLayer);
            // Ripristina mappa stradale
            if (!this.map.hasLayer(this.streetLayer)) this.map.addLayer(this.streetLayer);
        }

        setTimeout(() => this.map.invalidateSize(), 50);
    },

    toggleSatellite() {
        this.isSatellite = !this.isSatellite;
        this.updateBaseLayer();
        return this.isSatellite;
    },

    toggleDarkMode(forcedState) {
        if (typeof forcedState === 'boolean') {
            this.isDarkMode = forcedState;
        } else {
            this.isDarkMode = !this.isDarkMode;
        }
        this.updateBaseLayer();
        return this.isDarkMode;
    },

    // --- Disegna Tracciato Percorso Stradale & Zona Pit-Stop ---
    routeLayer: null,
    refuelZoneLayer: null,

    drawRoute(geojson) {
        this.clearRoute();

        this.routeLayer = L.geoJSON(geojson, {
            style: {
                color: '#0066FF',
                weight: 6,
                opacity: 0.85,
                lineJoin: 'round',
                lineCap: 'round'
            }
        }).addTo(this.map);

        try {
            const bounds = this.routeLayer.getBounds();
            if (bounds.isValid()) {
                this.map.fitBounds(bounds, { padding: [60, 60] });
            }
        } catch (e) {
            console.warn('Errore calcolo bounds rotta:', e);
        }
    },

    drawRefuelZone(coords, cumDist, kmMin, kmMax) {
        this.clearRefuelZone();

        const meterMin = kmMin * 1000;
        const meterMax = kmMax * 1000;

        // Estrai coordinate [lat, lon] comprese nella finestra chilometrica
        const zoneCoords = [];
        for (let i = 0; i < coords.length; i++) {
            const m = cumDist[i];
            if (m >= meterMin && m <= meterMax) {
                // coords[i] è [lon, lat], Leaflet polyline richiede [lat, lon]
                zoneCoords.push([coords[i][1], coords[i][0]]);
            }
        }

        if (zoneCoords.length < 2) return;

        this.refuelZoneLayer = L.layerGroup();

        // 1. Alone di fondo verde smeraldo
        const glowLine = L.polyline(zoneCoords, {
            color: '#10B981',
            weight: 12,
            opacity: 0.45,
            lineCap: 'round',
            lineJoin: 'round'
        });

        // 2. Linea tratteggiata di risalto
        const mainLine = L.polyline(zoneCoords, {
            color: '#047857',
            weight: 5,
            opacity: 0.95,
            dashArray: '8, 6',
            lineCap: 'round',
            lineJoin: 'round'
        });

        mainLine.bindTooltip(`🎯 <b>Zona Sosta Consigliata</b><br>Tra km ${kmMin.toFixed(0)} e km ${kmMax.toFixed(0)}`, {
            sticky: true,
            className: 'refuel-zone-tooltip'
        });

        this.refuelZoneLayer.addLayer(glowLine);
        this.refuelZoneLayer.addLayer(mainLine);
        this.refuelZoneLayer.addTo(this.map);
    },

    clearRefuelZone() {
        if (this.refuelZoneLayer) {
            this.map.removeLayer(this.refuelZoneLayer);
            this.refuelZoneLayer = null;
        }
    },

    clearRoute() {
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
        this.clearRefuelZone();
    }
};
