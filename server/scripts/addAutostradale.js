// ============================================================
// Aggiunta colonna 'autostradale' e marcatura delle aree di servizio
// ============================================================
const pool = require('../db');

async function updateAutostrade() {
    const client = await pool.connect();
    try {
        console.log('⏳ Aggiunta colonna autostradale su distributori...');
        await client.query(`
            ALTER TABLE distributori 
            ADD COLUMN IF NOT EXISTS autostradale BOOLEAN DEFAULT false;

            CREATE INDEX IF NOT EXISTS idx_distributori_autostradale 
            ON distributori (autostradale);
        `);

        console.log('⏳ Individuazione e marcatura impianti autostradali...');
        const res = await client.query(`
            UPDATE distributori
            SET autostradale = true
            WHERE 
                indirizzo ILIKE '%autostrad%' OR
                nome ILIKE '%autostrad%' OR
                indirizzo ILIKE '%tangenziale%' OR
                nome ILIKE '%tangenziale%' OR
                indirizzo ILIKE '%raccordo%' OR
                nome ILIKE '%raccordo%' OR
                indirizzo ILIKE 'A_ km%' OR
                indirizzo ILIKE 'A__ km%' OR
                indirizzo ILIKE 'A___ km%' OR
                indirizzo ILIKE '% A1 %' OR
                indirizzo ILIKE '% A4 %' OR
                indirizzo ILIKE '% A14 %' OR
                indirizzo ILIKE '% A24 %' OR
                indirizzo ILIKE '% A25 %' OR
                indirizzo ILIKE '% A22 %' OR
                indirizzo ILIKE '% A21 %' OR
                indirizzo ILIKE '% A10 %' OR
                indirizzo ILIKE '% A12 %' OR
                indirizzo ILIKE '% A13 %' OR
                indirizzo ILIKE '% A16 %' OR
                indirizzo ILIKE '% A26 %' OR
                indirizzo ILIKE '% A30 %' OR
                indirizzo ILIKE '% A2 %' OR
                indirizzo ILIKE '% A3 %' OR
                nome ILIKE '% ADS %' OR
                nome ILIKE '%area di servizio%' OR
                indirizzo ILIKE '%area di servizio%';
        `);

        console.log(`✅ ${res.rowCount} distributori marcati come AUTOSTRADALI / TANGENZIALI.`);

    } catch (err) {
        console.error('❌ Errore aggiornamento autostrade:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

updateAutostrade();
