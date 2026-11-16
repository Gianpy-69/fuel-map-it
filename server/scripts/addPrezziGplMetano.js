// Migrazione: aggiunge prezzo_gpl e prezzo_metano a stato_operativo
const pool = require('../db');

async function migrate() {
    console.log('🔧 Aggiunta colonne prezzo_gpl e prezzo_metano...');
    await pool.query(`
        ALTER TABLE stato_operativo
        ADD COLUMN IF NOT EXISTS prezzo_gpl DECIMAL(4,3),
        ADD COLUMN IF NOT EXISTS prezzo_metano DECIMAL(4,3);
    `);
    console.log('✅ Colonne prezzo_gpl e prezzo_metano create con successo!');
    await pool.end();
}

migrate().catch(console.error);
