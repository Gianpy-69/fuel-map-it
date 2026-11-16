// Migrazione: aggiunge id_mimit a distributori
const pool = require('../db');

async function migrate() {
    console.log('🔧 Aggiunta colonna id_mimit al database...');
    await pool.query(`
        ALTER TABLE distributori ADD COLUMN IF NOT EXISTS id_mimit INT;
        CREATE INDEX IF NOT EXISTS idx_distributori_id_mimit ON distributori(id_mimit);
    `);
    console.log('✅ Colonna id_mimit e indice creati con successo!');
    await pool.end();
}

migrate().catch(console.error);
