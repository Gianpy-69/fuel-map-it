// ============================================
// Fuel Map Italia — Entry Point Server
// ============================================
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const distributoriRoutes = require('./routes/distributori');
const segnalazioniRoutes = require('./routes/segnalazioni');
const { initScheduler } = require('./cron/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware globali
app.use(cors());
app.use(express.json());

// File statici (frontend)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotte API
app.use('/api/distributori', distributoriRoutes);
app.use('/api/segnalazioni', segnalazioniRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Avvio server
app.listen(PORT, () => {
    console.log(`🚀 Server avviato su http://localhost:${PORT}`);
    // Avvia scheduler per aggiornamento automatico prezzi alle 08:35
    initScheduler();
});
