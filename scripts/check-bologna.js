const pool = require('../server/db');

async function checkBologna() {
    try {
        const resComune = await pool.query("SELECT id, bandiera, comune, provincia, indirizzo, ST_AsText(posizione) as geom FROM distributori WHERE comune ILIKE '%bologna%' LIMIT 10");
        console.log('Distributori con comune Bologna:', resComune.rows.length);
        console.log('Esempi:', resComune.rows);

        const resProv = await pool.query("SELECT count(*) as count_bo FROM distributori WHERE provincia = 'BO'");
        console.log('Distributori provincia BO:', resProv.rows[0].count_bo);

        const resProvince = await pool.query("SELECT provincia, count(*) FROM distributori GROUP BY provincia ORDER BY count DESC LIMIT 15");
        console.log('Top 15 province nel DB:', resProvince.rows);

        const total = await pool.query("SELECT count(*) as tot FROM distributori");
        console.log('Totale distributori nel DB:', total.rows[0].tot);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkBologna();
