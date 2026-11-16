BEGIN;

-- =========================================================
-- Fuel Map Italia - Allineamento schema/backend
-- Migration: 003_alignment.sql
-- =========================================================

-- ---------------------------------------------------------
-- Colonne utilizzate dal backend nella tabella distributori
-- ---------------------------------------------------------

ALTER TABLE distributori
    ADD COLUMN IF NOT EXISTS autostradale BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE distributori
    ADD COLUMN IF NOT EXISTS nascosto BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE distributori
    ADD COLUMN IF NOT EXISTS segnalazioni_errore INTEGER NOT NULL DEFAULT 0;

ALTER TABLE distributori
    ADD CONSTRAINT distributori_segnalazioni_errore_non_negative
    CHECK (segnalazioni_errore >= 0);

-- ---------------------------------------------------------
-- Prezzi GPL e metano nello stato operativo
-- ---------------------------------------------------------

ALTER TABLE stato_operativo
    ADD COLUMN IF NOT EXISTS prezzo_gpl NUMERIC(5, 3);

ALTER TABLE stato_operativo
    ADD COLUMN IF NOT EXISTS prezzo_metano NUMERIC(5, 3);

-- Validazione prezzi non negativi
ALTER TABLE stato_operativo
    ADD CONSTRAINT stato_operativo_prezzi_non_negativi
    CHECK (
        (prezzo_benzina IS NULL OR prezzo_benzina >= 0) AND
        (prezzo_diesel IS NULL OR prezzo_diesel >= 0) AND
        (prezzo_gpl IS NULL OR prezzo_gpl >= 0) AND
        (prezzo_metano IS NULL OR prezzo_metano >= 0)
    );

-- ---------------------------------------------------------
-- Storico prezzi
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS storico_prezzi (
    id BIGSERIAL PRIMARY KEY,
    distributore_id INTEGER NOT NULL
        REFERENCES distributori(id)
        ON DELETE CASCADE,

    data_rilevazione TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    prezzo_benzina NUMERIC(5, 3),
    prezzo_diesel NUMERIC(5, 3),
    prezzo_gpl NUMERIC(5, 3),
    prezzo_metano NUMERIC(5, 3),

    fonte VARCHAR(50) NOT NULL DEFAULT 'mimit',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT storico_prezzi_almeno_un_prezzo
    CHECK (
        prezzo_benzina IS NOT NULL OR
        prezzo_diesel IS NOT NULL OR
        prezzo_gpl IS NOT NULL OR
        prezzo_metano IS NOT NULL
    ),

    CONSTRAINT storico_prezzi_valori_non_negativi
    CHECK (
        (prezzo_benzina IS NULL OR prezzo_benzina >= 0) AND
        (prezzo_diesel IS NULL OR prezzo_diesel >= 0) AND
        (prezzo_gpl IS NULL OR prezzo_gpl >= 0) AND
        (prezzo_metano IS NULL OR prezzo_metano >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_storico_prezzi_distributore_data
    ON storico_prezzi (distributore_id, data_rilevazione DESC);

CREATE INDEX IF NOT EXISTS idx_storico_prezzi_data
    ON storico_prezzi (data_rilevazione DESC);

-- ---------------------------------------------------------
-- Vincolo tipo segnalazione
-- ---------------------------------------------------------

ALTER TABLE segnalazioni_utenti
    DROP CONSTRAINT IF EXISTS segnalazioni_utenti_tipo_segnalazione_check;

ALTER TABLE segnalazioni_utenti
    ADD CONSTRAINT segnalazioni_utenti_tipo_segnalazione_check
    CHECK (
        tipo_segnalazione IN (
            'stato',
            'prezzo',
            'coda',
            'carburante_esaurito',
            'riaperto',
            'posizione_errata'
        )
    );

-- ---------------------------------------------------------
-- Indici per crowdsourcing
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_segnalazioni_sessione_recenti
    ON segnalazioni_utenti (
        distributore_id,
        session_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_segnalazioni_tipo_recenti
    ON segnalazioni_utenti (
        distributore_id,
        tipo_segnalazione,
        created_at DESC
    );

-- ---------------------------------------------------------
-- Vincoli geografici
-- ---------------------------------------------------------

ALTER TABLE distributori
    ADD CONSTRAINT distributori_posizione_valida
    CHECK (ST_SRID(posizione::geometry) = 4326);

ALTER TABLE segnalazioni_utenti
    ADD CONSTRAINT segnalazioni_posizione_valida
    CHECK (
        posizione_utente IS NULL OR
        ST_SRID(posizione_utente::geometry) = 4326
    );

COMMIT;