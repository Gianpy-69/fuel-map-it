// ============================================================
// Rotte segnalazioni – Motore di Consenso + Posizione Errata
// ============================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const pool = require('../db');
const rateLimiter = require('../middleware/rateLimiter');

// Cartella upload locale per caching rapido
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurazione Upload Foto in memoria per elaborazione e compressione WebP
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Max 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const mime = allowed.test(file.mimetype);
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        if (mime && ext) return cb(null, true);
        cb(new Error('Formato immagine non supportato. Usa JPG, PNG o WebP.'));
    }
});

// GET /api/segnalazioni/foto/:filename - Recupero persistente foto (Cache locale o Supabase DB)
router.get('/foto/:filename', async (req, res) => {
    try {
        const filename = path.basename(req.params.filename);
        const filePath = path.join(uploadDir, filename);

        // 1. Se il file è presente nella cache locale del server
        if (fs.existsSync(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(filePath);
        }

        // 2. Se il disco di Render si è azzerato al riavvio, recupera il backup da PostgreSQL
        const result = await pool.query(`
            SELECT dettagli->>'foto_base64' AS foto_base64
            FROM segnalazioni_utenti
            WHERE dettagli->>'foto_filename' = $1 OR dettagli->>'foto_url' LIKE '%' || $1
            LIMIT 1
        `, [filename]);

        if (result.rows.length > 0 && result.rows[0].foto_base64) {
            const imgBuffer = Buffer.from(result.rows[0].foto_base64, 'base64');
            try {
                fs.writeFileSync(filePath, imgBuffer);
            } catch (_) {}

            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(imgBuffer);
        }

        return res.status(404).send('Foto non trovata');
    } catch (err) {
        console.error('Errore recupero foto segnalazione:', err.message);
        return res.status(500).send('Errore caricamento immagine');
    }
});

// POST /api/segnalazioni
router.post('/', rateLimiter, upload.single('foto'), async (req, res) => {
    const client = await pool.connect();
    try {
        let { 
            distributore_id, 
            tipo_segnalazione, 
            dettagli,
            lat_utente,
            lon_utente
        } = req.body;

        if (typeof dettagli === 'string') {
            try { dettagli = JSON.parse(dettagli); } catch (e) { dettagli = {}; }
        } else if (!dettagli) {
            dettagli = {};
        }

        distributore_id = parseInt(distributore_id, 10);
        if (!distributore_id || !tipo_segnalazione) {
            return res.status(400).json({ errore: 'distributore_id e tipo_segnalazione obbligatori' });
        }

        if (req.file) {
            try {
                // Comprimi e ottimizza immagine in WebP (max 1000px, 30-50 KB)
                const compressedBuffer = await sharp(req.file.buffer)
                    .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 78 })
                    .toBuffer();

                const filename = `report_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
                const filePath = path.join(uploadDir, filename);

                // Scrivi su disco per accesso immediato
                fs.writeFileSync(filePath, compressedBuffer);

                // Salva backup persistente in base64 nel database per non perderla ai riavvii
                dettagli.foto_filename = filename;
                dettagli.foto_base64 = compressedBuffer.toString('base64');
                dettagli.foto_url = `/api/segnalazioni/foto/${filename}`;
            } catch (imgErr) {
                console.warn('Errore compressione foto:', imgErr.message);
            }
        }

        const distCheck = await client.query('SELECT id FROM distributori WHERE id = $1', [distributore_id]);
        if (distCheck.rows.length === 0) {
            return res.status(404).json({ errore: 'Distributore non trovato' });
        }

        const sessionId = req.headers['x-session-id'] || req.body.session_id || crypto.randomUUID();
        const ipRaw = req.ip || req.connection.remoteAddress || '0.0.0.0';
        const ipHash = crypto.createHash('sha256').update(ipRaw).digest('hex').substring(0, 16);

        await client.query('BEGIN');

        const numLat = parseFloat(lat_utente);
        const numLon = parseFloat(lon_utente);
        const hasValidCoords = Number.isFinite(numLat) && Number.isFinite(numLon) &&
                               numLat >= 35.5 && numLat <= 47.1 && numLon >= 6.6 && numLon <= 18.5;

        // 1. Inserimento segnalazione con parametri protetti
        const insertParams = [
            distributore_id,
            tipo_segnalazione,
            JSON.stringify(dettagli),
            sessionId,
            ipHash
        ];

        let insertSql = `
            INSERT INTO segnalazioni_utenti 
                (distributore_id, tipo_segnalazione, dettagli, session_id, ip_hash, posizione_utente)
            VALUES ($1, $2, $3, $4, $5, NULL)
        `;

        if (hasValidCoords) {
            insertParams.push(numLon, numLat);
            insertSql = `
                INSERT INTO segnalazioni_utenti 
                    (distributore_id, tipo_segnalazione, dettagli, session_id, ip_hash, posizione_utente)
                VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography)
            `;
        }

        await client.query(insertSql, insertParams);

        // 2. SE È UNA SEGNALAZIONE DI POSIZIONE ERRATA
        if (tipo_segnalazione === 'posizione_errata') {
            await client.query(`
                UPDATE distributori
                SET 
                    segnalazioni_errore = segnalazioni_errore + 1,
                    nascosto = CASE WHEN segnalazioni_errore + 1 >= 3 THEN true ELSE nascosto END
                WHERE id = $1
            `, [distributore_id]);

            await client.query('COMMIT');
            return res.status(201).json({
                messaggio: 'Segnalazione di posizione errata registrata. Grazie per il supporto!'
            });
        }

        // 3. ALGORITMO DI CONSENSO NORMALE (Stato / Carburante / Coda)
        const consensusResult = await client.query(`
            SELECT 
                COUNT(*) FILTER (WHERE tipo_segnalazione IN ('riaperto') OR (tipo_segnalazione = 'stato' AND dettagli->>'stato' = 'aperto')) AS voti_aperto,
                COUNT(*) FILTER (WHERE tipo_segnalazione = 'stato' AND dettagli->>'stato' = 'chiuso') AS voti_chiuso,
                COUNT(*) FILTER (WHERE tipo_segnalazione = 'carburante_esaurito' AND dettagli->>'carburante' = 'benzina') AS voti_no_benzina,
                COUNT(*) FILTER (WHERE tipo_segnalazione = 'carburante_esaurito' AND dettagli->>'carburante' = 'diesel') AS voti_no_diesel,
                ROUND(AVG((dettagli->>'livello')::numeric) FILTER (WHERE tipo_segnalazione = 'coda')) AS media_coda,
                COUNT(*) AS totale_segnalazioni_recenti
            FROM segnalazioni_utenti
            WHERE distributore_id = $1 
              AND created_at >= NOW() - INTERVAL '90 minutes'
        `, [distributore_id]);

        const c = consensusResult.rows[0];
        const votiAperto = parseInt(c.voti_aperto, 10) || 0;
        const votiChiuso = parseInt(c.voti_chiuso, 10) || 0;
        const votiNoBenzina = parseInt(c.voti_no_benzina, 10) || 0;
        const votiNoDiesel = parseInt(c.voti_no_diesel, 10) || 0;
        const mediaCoda = c.media_coda !== null ? parseInt(c.media_coda, 10) : null;

        let nuovoStato = 'aperto';
        if (votiChiuso > votiAperto) {
            nuovoStato = 'chiuso';
        } else if (votiChiuso > 0 && votiChiuso === votiAperto) {
            nuovoStato = 'parziale';
        }

        const benzinaDisponibile = votiNoBenzina < 2;
        const dieselDisponibile = votiNoDiesel < 2;

        let updateSql = `
            UPDATE stato_operativo 
            SET 
                stato = $2,
                benzina_disponibile = $3,
                diesel_disponibile = $4,
                conferme = conferme + 1,
                ultimo_aggiornamento = NOW()
        `;
        let updateParams = [distributore_id, nuovoStato, benzinaDisponibile, dieselDisponibile];

        if (mediaCoda !== null) {
            updateSql += `, livello_coda = $${updateParams.length + 1}`;
            updateParams.push(mediaCoda);
        }

        updateSql += ` WHERE distributore_id = $1`;
        await client.query(updateSql, updateParams);

        await client.query('COMMIT');

        res.status(201).json({
            messaggio: 'Segnalazione registrata con successo',
            consenso: {
                stato: nuovoStato,
                voti_aperto: votiAperto,
                voti_chiuso: votiChiuso,
                livello_coda: mediaCoda
            },
            foto_url: dettagli.foto_url || null
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Errore elaborazione segnalazione:', err.message);
        res.status(500).json({ errore: err.message || 'Errore interno del server' });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;