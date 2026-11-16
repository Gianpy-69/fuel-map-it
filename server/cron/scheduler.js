// ============================================================
// Scheduler Cron — Aggiornamento Prezzi + Riapertura Automatica
// ============================================================
const cron = require('node-cron');
const { runPrezziImport } = require('../scripts/importPrezzi');
const pool = require('../db');

async function autoReopenStations() {
    try {
        // Riapre le stazioni chiuse da più di 12 ore (chiusure crowdsourcing scadute)
        const result = await pool.query(`
            UPDATE stato_operativo
            SET stato = 'aperto', ultimo_aggiornamento = NOW()
            WHERE stato = 'chiuso'
              AND ultimo_aggiornamento < NOW() - INTERVAL '12 hours'
        `);
        if (result.rowCount > 0) {
            console.log(`🔓 [Cron] ${result.rowCount} stazioni riaperte automaticamente (chiuse da >12h)`);
        }
    } catch (err) {
        console.error('❌ [Cron] Errore riapertura automatica:', err.message);
    }
}

function initScheduler() {
    // Ogni mattina alle 08:35 — aggiornamento prezzi MIMIT
    cron.schedule('35 8 * * *', async () => {
        console.log('⏰ [Cron] Avvio aggiornamento automatico giornaliero prezzi MIMIT...');
        try {
            await runPrezziImport({ closePool: false });
        } catch (err) {
            console.error('❌ [Cron] Errore sincronizzazione giornaliera:', err.message);
        }
    }, {
        scheduled: true,
        timezone: 'Europe/Rome'
    });

    // Ogni 2 ore — riapertura automatica stazioni chiuse da >12h
    cron.schedule('0 */2 * * *', autoReopenStations, {
        scheduled: true,
        timezone: 'Europe/Rome'
    });

    console.log('📅 Scheduler attivo: prezzi 08:35, riapertura auto ogni 2h.');
}

module.exports = { initScheduler };
