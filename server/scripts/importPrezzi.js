// ============================================================
// Script di importazione Prezzi Carburanti Ufficiali MIMIT
// Utilizzabile sia da CLI sia tramite Cron Job schedulato
// ============================================================
const readline = require('readline');
const { Readable } = require('stream');
const pool = require('../db');

const MIMIT_PREZZI_URL = 'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';

async function runPrezziImport(options = { closePool: true }) {
    console.log(`\n⏰ [${new Date().toLocaleTimeString('it-IT')}] Sincronizzazione prezzi MIMIT avviata...`);

    const response = await fetch(MIMIT_PREZZI_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Errore HTTP MIMIT: ${response.status} ${response.statusText}`);
    }

    const nodeStream = Readable.fromWeb(response.body);
    const rl = readline.createInterface({
        input: nodeStream,
        crlfDelay: Infinity
    });

    let lineNumber = 0;
    const prezziMap = new Map();

    for await (const line of rl) {
        lineNumber++;
        if (lineNumber <= 2) continue;

        const parts = line.split('|');
        if (parts.length < 5) continue;

        const idImpianto = parseInt(parts[0], 10);
        const descCarburante = parts[1]?.trim().toLowerCase() || '';
        const prezzo = parseFloat(parts[2]?.replace(',', '.'));
        const isSelf = parts[3]?.trim() === '1';

        if (isNaN(idImpianto) || isNaN(prezzo) || prezzo <= 0 || prezzo > 5) continue;

        if (!prezziMap.has(idImpianto)) {
            prezziMap.set(idImpianto, {
                benzina: null,
                diesel: null,
                gpl: null,
                metano: null
            });
        }

        const p = prezziMap.get(idImpianto);

        if (descCarburante.includes('benzina')) {
            if (!p.benzina || isSelf) p.benzina = prezzo;
        } else if (descCarburante.includes('gasolio') || descCarburante.includes('diesel')) {
            if (!p.diesel || isSelf) p.diesel = prezzo;
        } else if (descCarburante.includes('gpl')) {
            p.gpl = prezzo;
        } else if (descCarburante.includes('metano')) {
            p.metano = prezzo;
        }
    }

    console.log(`📊 Prezzi pronti per ${prezziMap.size} distributori. Aggiornamento DB...`);

    const client = await pool.connect();
    try {
        let updatedCount = 0;
        const entries = Array.from(prezziMap.entries());
        const BATCH = 500;

        for (let i = 0; i < entries.length; i += BATCH) {
            const chunk = entries.slice(i, i + BATCH);
            await client.query('BEGIN');

            for (const [idImpianto, p] of chunk) {
                await client.query(`
                    UPDATE stato_operativo s
                    SET
                        prezzo_benzina = COALESCE($2, s.prezzo_benzina),
                        prezzo_diesel  = COALESCE($3, s.prezzo_diesel),
                        prezzo_gpl     = COALESCE($4, s.prezzo_gpl),
                        prezzo_metano  = COALESCE($5, s.prezzo_metano),
                        gpl_disponibile = CASE WHEN $4::numeric IS NOT NULL THEN true ELSE s.gpl_disponibile END,
                        metano_disponibile = CASE WHEN $5::numeric IS NOT NULL THEN true ELSE s.metano_disponibile END,
                        ultimo_aggiornamento = NOW()
                    FROM distributori d
                    WHERE s.distributore_id = d.id AND d.id_mimit = $1
                `, [idImpianto, p.benzina, p.diesel, p.gpl, p.metano]);
            }

            await client.query('COMMIT');
            updatedCount += chunk.length;
        }

        // Regola Automatica: Chi non ha comunicato prezzi oggi viene marcato come inattivo/sconosciuto
        const inactiveRes = await client.query(`
            UPDATE stato_operativo
            SET
                stato = 'sconosciuto',
                benzina_disponibile = false,
                diesel_disponibile = false
            WHERE prezzo_benzina IS NULL AND prezzo_diesel IS NULL
        `);

        // Archiviazione automatica nello storico_prezzi
        await client.query(`
            INSERT INTO storico_prezzi (distributore_id, prezzo_benzina, prezzo_diesel, prezzo_gpl, prezzo_metano, data_rilevazione)
            SELECT distributore_id, prezzo_benzina, prezzo_diesel, prezzo_gpl, prezzo_metano, CURRENT_DATE
            FROM stato_operativo
            WHERE prezzo_benzina IS NOT NULL OR prezzo_diesel IS NOT NULL
            ON CONFLICT (distributore_id, data_rilevazione) DO UPDATE
            SET
                prezzo_benzina = EXCLUDED.prezzo_benzina,
                prezzo_diesel = EXCLUDED.prezzo_diesel,
                prezzo_gpl = EXCLUDED.prezzo_gpl,
                prezzo_metano = EXCLUDED.prezzo_metano;
        `);

        console.log(`✅ [${new Date().toLocaleTimeString('it-IT')}] Prezzi aggiornati con successo! (${inactiveRes.rowCount} inattivi).`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Errore update prezzi:', err.message);
    } finally {
        client.release();
        if (options.closePool) {
            await pool.end();
        }
    }
}

// Se eseguito direttamente da terminale (node importPrezzi.js)
if (require.main === module) {
    runPrezziImport({ closePool: true }).catch((err) => {
        console.error('❌ Errore durante l\'import prezzi:', err);
        process.exit(1);
    });
}

module.exports = { runPrezziImport };
