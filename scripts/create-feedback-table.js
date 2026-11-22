const pool = require('../server/db');

async function createTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS feedback_utenti (
                id SERIAL PRIMARY KEY,
                messaggio TEXT NOT NULL,
                email VARCHAR(200),
                app_version VARCHAR(20) DEFAULT '1.0.0',
                session_id VARCHAR(64),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ Tabella feedback_utenti creata su PostgreSQL!');
    } catch (e) {
        console.error('Errore creazione tabella feedback:', e.message);
    } finally {
        await pool.end();
    }
}

createTable();
