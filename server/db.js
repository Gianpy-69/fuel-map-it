// ============================================
// Pool di connessione PostgreSQL
// ============================================
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000
    }
    : {
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT, 10),
        database: process.env.DB_NAME,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max:      10,
        idleTimeoutMillis: 30000
    };

const pool = new Pool(dbConfig);

// Log connessione riuscita (solo al primo tentativo)
pool.on('connect', () => {
    console.log('📦 Connesso a PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Errore pool PostgreSQL:', err.message);
});

module.exports = pool;
