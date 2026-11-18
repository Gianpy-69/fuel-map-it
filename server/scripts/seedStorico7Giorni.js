// Script per popolare lo storico prezzi degli ultimi 7 giorni
const pool = require('../db');

async function seedStorico() {
    console.log('🌱 Popolamento storico prezzi per gli ultimi 7 giorni...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Pulisci eventuale storico parziale
        await client.query('TRUNCATE TABLE storico_prezzi RESTART IDENTITY');

        // Inserisci per gli ultimi 7 giorni (da 6 giorni fa a oggi)
        // Usiamo una variazione realistica deterministica (+- 0.015 €)
        const query = `
            INSERT INTO storico_prezzi (
                distributore_id,
                prezzo_benzina,
                prezzo_diesel,
                prezzo_gpl,
                prezzo_metano,
                data_rilevazione,
                fonte
            )
            SELECT
                s.distributore_id,
                ROUND(
                    CASE 
                        WHEN s.prezzo_benzina IS NOT NULL 
                        THEN (s.prezzo_benzina + ((sin(s.distributore_id * 0.13 + days.d * 1.7) * 0.012) + (days.d * 0.002)))::numeric
                        ELSE NULL 
                    END, 3
                ) AS prezzo_benzina,
                ROUND(
                    CASE 
                        WHEN s.prezzo_diesel IS NOT NULL 
                        THEN (s.prezzo_diesel + ((cos(s.distributore_id * 0.17 + days.d * 1.5) * 0.011) + (days.d * 0.002)))::numeric
                        ELSE NULL 
                    END, 3
                ) AS prezzo_diesel,
                ROUND(
                    CASE 
                        WHEN s.prezzo_gpl IS NOT NULL 
                        THEN (s.prezzo_gpl + ((sin(s.distributore_id * 0.05 + days.d * 1.1) * 0.005)))::numeric
                        ELSE NULL 
                    END, 3
                ) AS prezzo_gpl,
                ROUND(
                    CASE 
                        WHEN s.prezzo_metano IS NOT NULL 
                        THEN (s.prezzo_metano + ((cos(s.distributore_id * 0.07 + days.d * 0.9) * 0.006)))::numeric
                        ELSE NULL 
                    END, 3
                ) AS prezzo_metano,
                (CURRENT_DATE - (days.d * INTERVAL '1 day')) + TIME '08:35:00' AS data_rilevazione,
                'mimit' AS fonte
            FROM stato_operativo s
            CROSS JOIN (
                SELECT 6 AS d UNION ALL
                SELECT 5 UNION ALL
                SELECT 4 UNION ALL
                SELECT 3 UNION ALL
                SELECT 2 UNION ALL
                SELECT 1 UNION ALL
                SELECT 0
            ) days
            WHERE s.prezzo_benzina IS NOT NULL OR s.prezzo_diesel IS NOT NULL;
        `;

        const result = await client.query(query);
        await client.query('COMMIT');
        console.log(`✅ Inserite ${result.rowCount} rilevazioni storiche (7 giorni completi per tutti i distributori).`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Errore:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

seedStorico();
