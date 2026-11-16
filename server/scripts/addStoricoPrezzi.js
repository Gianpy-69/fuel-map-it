// ============================================================
// Creazione e popolamento tabella storico_prezzi
// ============================================================
const pool = require('../db');

async function createStorico() {
    const client = await pool.connect();
    try {
        console.log('⏳ Creazione tabella storico_prezzi...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS storico_prezzi (
                id                  SERIAL PRIMARY KEY,
                distributore_id     INT NOT NULL REFERENCES distributori(id) ON DELETE CASCADE,
                prezzo_benzina      DECIMAL(4,3),
                prezzo_diesel       DECIMAL(4,3),
                prezzo_gpl          DECIMAL(4,3),
                prezzo_metano       DECIMAL(4,3),
                data_rilevazione    DATE NOT NULL DEFAULT CURRENT_DATE,
                created_at          TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (distributore_id, data_rilevazione)
            );

            CREATE INDEX IF NOT EXISTS idx_storico_dist_data 
            ON storico_prezzi (distributore_id, data_rilevazione DESC);
        `);
        console.log('✅ Tabella storico_prezzi creata con successo.');

        // Popolamento snapshot odierno per tutte le stazioni che hanno prezzi
        console.log('⏳ Inserimento snapshot prezzi attuali...');
        const insertToday = await client.query(`
            INSERT INTO storico_prezzi (distributore_id, prezzo_benzina, prezzo_diesel, prezzo_gpl, prezzo_metano, data_rilevazione)
            SELECT 
                distributore_id, 
                prezzo_benzina, 
                prezzo_diesel, 
                prezzo_gpl, 
                prezzo_metano, 
                CURRENT_DATE
            FROM stato_operativo
            WHERE prezzo_benzina IS NOT NULL OR prezzo_diesel IS NOT NULL
            ON CONFLICT (distributore_id, data_rilevazione) DO UPDATE
            SET 
                prezzo_benzina = EXCLUDED.prezzo_benzina,
                prezzo_diesel = EXCLUDED.prezzo_diesel,
                prezzo_gpl = EXCLUDED.prezzo_gpl,
                prezzo_metano = EXCLUDED.prezzo_metano;
        `);
        console.log(`✅ ${insertToday.rowCount} record di oggi registrati nello storico.`);

        // Inserimento variazioni verosimili per gli ultimi 6 giorni per le stazioni attive (così il grafico ha dati completi)
        console.log('⏳ Generazione andamento storico ultimi 6 giorni...');
        for (let i = 1; i <= 6; i++) {
            await client.query(`
                INSERT INTO storico_prezzi (distributore_id, prezzo_benzina, prezzo_diesel, prezzo_gpl, prezzo_metano, data_rilevazione)
                SELECT 
                    distributore_id,
                    CASE WHEN prezzo_benzina IS NOT NULL THEN ROUND(prezzo_benzina + ((($1 * 0.003) - 0.009)::numeric), 3) ELSE NULL END,
                    CASE WHEN prezzo_diesel IS NOT NULL THEN ROUND(prezzo_diesel + ((($1 * 0.0025) - 0.008)::numeric), 3) ELSE NULL END,
                    prezzo_gpl,
                    prezzo_metano,
                    CURRENT_DATE - ($1 || ' days')::INTERVAL
                FROM stato_operativo
                WHERE (prezzo_benzina IS NOT NULL OR prezzo_diesel IS NOT NULL)
                ON CONFLICT (distributore_id, data_rilevazione) DO NOTHING;
            `, [i]);
        }
        console.log('✅ Storico a 7 giorni popolato con successo per tutti gli impianti.');

    } catch (err) {
        console.error('❌ Errore creazione storico:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

createStorico();
