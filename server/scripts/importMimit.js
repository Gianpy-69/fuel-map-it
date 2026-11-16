// ============================================================
// Script di importazione Open Data MIMIT con ID Ministeriale
// ============================================================
const readline = require('readline');
const { Readable } = require('stream');
const pool = require('../db');

const MIMIT_CSV_URL = 'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv';

async function runImport() {
    console.log('📡 Connessione al portale MIMIT...');
    
    const response = await fetch(MIMIT_CSV_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    console.log(`📥 Download anagrafica avviato...`);

    const nodeStream = Readable.fromWeb(response.body);
    const rl = readline.createInterface({ input: nodeStream, crlfDelay: Infinity });

    let lineNumber = 0;
    let batch = [];
    const BATCH_SIZE = 500;
    let totalImported = 0;

    // Svuotiamo i vecchi record per evitare duplicati
    const client = await pool.connect();
    await client.query('TRUNCATE distributori RESTART IDENTITY CASCADE;');
    client.release();

    for await (const line of rl) {
        lineNumber++;
        if (lineNumber <= 2) continue;

        const parts = line.split('|');
        if (parts.length < 10) continue;

        const idMimit = parseInt(parts[0]?.trim(), 10);
        const bandiera = parts[2]?.trim() || 'Pompe Bianche';
        const nome = parts[4]?.trim() || bandiera;
        const indirizzo = parts[5]?.trim() || '';
        const comune = parts[6]?.trim() || '';
        const provincia = (parts[7]?.trim() || '').substring(0, 2).toUpperCase();
        const lat = parseFloat(parts[8]?.replace(',', '.'));
        const lon = parseFloat(parts[9]?.replace(',', '.'));

        if (isNaN(idMimit) || isNaN(lat) || isNaN(lon) || lat < 35.5 || lat > 47.1 || lon < 6.6 || lon > 18.5) {
            continue;
        }

        batch.push({
            idMimit,
            nome: nome.substring(0, 200),
            indirizzo: indirizzo.substring(0, 300),
            comune: comune.substring(0, 100),
            provincia,
            bandiera: bandiera.substring(0, 50),
            lat,
            lon
        });

        if (batch.length >= BATCH_SIZE) {
            await insertBatchFast(batch);
            totalImported += batch.length;
            process.stdout.write(`\r⛽ Distributori importati con ID MIMIT: ${totalImported}...`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        await insertBatchFast(batch);
        totalImported += batch.length;
    }

    console.log(`\n✅ Anagrafica importata! Totale: ${totalImported} distributori.`);
    await pool.end();
}

async function insertBatchFast(items) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const valueRows = [];
        const params = [];
        let pIdx = 1;

        for (const item of items) {
            valueRows.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, ST_MakePoint($${pIdx + 7}, $${pIdx + 6})::geography)`);
            params.push(item.idMimit, item.nome, item.indirizzo, item.comune, item.provincia, item.bandiera, item.lat, item.lon);
            pIdx += 8;
        }

        const insertSql = `
            INSERT INTO distributori (id_mimit, nome, indirizzo, comune, provincia, bandiera, posizione)
            VALUES ${valueRows.join(', ')}
            RETURNING id
        `;
        const res = await client.query(insertSql, params);
        const insertedIds = res.rows.map(r => r.id);

        await client.query(`
            INSERT INTO stato_operativo (distributore_id, stato, benzina_disponibile, diesel_disponibile)
            SELECT unnest($1::int[]), 'aperto', true, true
            ON CONFLICT (distributore_id) DO NOTHING
        `, [insertedIds]);

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\nErrore batch:', err.message);
    } finally {
        client.release();
    }
}

runImport().catch(console.error);
