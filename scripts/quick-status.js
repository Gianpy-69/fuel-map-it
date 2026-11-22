const pool = require('../server/db');

async function test() {
    try {
        const total = await pool.query("SELECT count(*) as tot FROM distributori");
        const withPrice = await pool.query("SELECT count(*) as tot FROM stato_operativo WHERE prezzo_benzina IS NOT NULL");
        const bo = await pool.query("SELECT count(*) as tot FROM distributori d JOIN stato_operativo s ON s.distributore_id = d.id WHERE d.provincia = 'BO'");
        const boWithPrice = await pool.query("SELECT count(*) as tot FROM distributori d JOIN stato_operativo s ON s.distributore_id = d.id WHERE d.provincia = 'BO' AND s.prezzo_benzina IS NOT NULL");
        console.log({
            distributoriTotali: total.rows[0].tot,
            conPrezzi: withPrice.rows[0].tot,
            bolognaTotali: bo.rows[0].tot,
            bolognaConPrezzi: boWithPrice.rows[0].tot
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

test();
