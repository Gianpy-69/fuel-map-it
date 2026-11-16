// ============================================
// Rate Limiter — max 10 segnalazioni/ora per IP
// ============================================
const rateLimit = require('express-rate-limit');

const segnalazioniLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 ora
    max: 10,                     // max 10 richieste per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        errore: 'Troppe segnalazioni. Riprova tra un\'ora.'
    }
});

module.exports = segnalazioniLimiter;
