// ============================================
// Fuel Map Italia — Entry Point Server
// ============================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const distributoriRoutes = require('./routes/distributori');
const segnalazioniRoutes = require('./routes/segnalazioni');
const { initScheduler } = require('./cron/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers con Helmet (Configurato per Leaflet, OpenStreetMap, Analytics e Capacitor)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://unpkg.com",
                "https://www.googletagmanager.com",
                "https://*.google-analytics.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://unpkg.com",
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://tiles.openfreemap.org",
                "https://server.arcgisonline.com",
                "https://unpkg.com",
                "https://www.google-analytics.com",
                "https://*.googletagmanager.com"
            ],
            connectSrc: [
                "'self'",
                "https://photon.komoot.io",
                "https://nominatim.openstreetmap.org",
                "https://tiles.openfreemap.org",
                "https://router.project-osrm.org",
                "https://fuel-map-it.onrender.com",
                "https://*.google-analytics.com",
                "https://*.analytics.google.com",
                "https://*.googletagmanager.com",
                "capacitor://localhost",
                "ionic://localhost",
                "https://localhost"
            ],
            workerSrc: ["'self'", "blob:"],
            upgradeInsecureRequests: null
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Middleware globali
app.use(cors({
    origin: [
        /^https?:\/\/localhost(:\d+)?$/,
        /^https?:\/\/fuel-map-it\.onrender\.com$/,
        'capacitor://localhost',
        'ionic://localhost'
    ],
    credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// Compressione gzip/brotli per ridurre il traffico (~60-80% in meno)
app.use(compression({ threshold: 1024 }));

// File statici (frontend)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotte API
app.use('/api/distributori', distributoriRoutes);
app.use('/api/segnalazioni', segnalazioniRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 per rotte API non esistenti
app.use('/api', (req, res) => {
    res.status(404).json({ errore: 'Endpoint non trovato' });
});

// 404 personalizzata per rotte web non esistenti
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

// Avvio server
app.listen(PORT, () => {
    console.log(`🚀 Server avviato su http://localhost:${PORT}`);
    // Avvia scheduler per aggiornamento automatico prezzi alle 08:35
    initScheduler();
});
