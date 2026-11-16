-- ============================================
-- Fuel Map Italia — Schema Database
-- ============================================

-- Abilita PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- 1. Anagrafica distributori
-- ============================================
CREATE TABLE distributori (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(200) NOT NULL,
    indirizzo       VARCHAR(300),
    comune          VARCHAR(100),
    provincia       CHAR(2),
    posizione       GEOGRAPHY(POINT, 4326) NOT NULL,
    bandiera        VARCHAR(50),          -- Brand: ENI, Q8, IP, Tamoil...
    self_service    BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indice spaziale GIST per query veloci
CREATE INDEX idx_distributori_posizione ON distributori USING GIST (posizione);

-- Indice per ricerche per comune/provincia
CREATE INDEX idx_distributori_comune ON distributori (comune, provincia);

-- ============================================
-- 2. Stato operativo (1:1 con distributori)
-- ============================================
CREATE TABLE stato_operativo (
    id                      SERIAL PRIMARY KEY,
    distributore_id         INT NOT NULL UNIQUE REFERENCES distributori(id) ON DELETE CASCADE,
    stato                   VARCHAR(20) DEFAULT 'sconosciuto'
                            CHECK (stato IN ('aperto','chiuso','parziale','sconosciuto')),
    benzina_disponibile     BOOLEAN DEFAULT true,
    diesel_disponibile      BOOLEAN DEFAULT true,
    gpl_disponibile         BOOLEAN,
    metano_disponibile      BOOLEAN,
    prezzo_benzina          DECIMAL(4,3),   -- es. 1.879
    prezzo_diesel           DECIMAL(4,3),
    livello_coda            SMALLINT DEFAULT 0 CHECK (livello_coda BETWEEN 0 AND 3),
    conferme                INT DEFAULT 0,
    ultimo_aggiornamento    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Segnalazioni utenti (crowdsourcing)
-- ============================================
CREATE TABLE segnalazioni_utenti (
    id                  SERIAL PRIMARY KEY,
    distributore_id     INT NOT NULL REFERENCES distributori(id) ON DELETE CASCADE,
    tipo_segnalazione   VARCHAR(30) NOT NULL
                        CHECK (tipo_segnalazione IN (
                            'stato','prezzo','coda','carburante_esaurito','riaperto'
                        )),
    dettagli            JSONB DEFAULT '{}',
    session_id          VARCHAR(64),
    ip_hash             VARCHAR(64),
    posizione_utente    GEOGRAPHY(POINT, 4326),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per query recenti per distributore
CREATE INDEX idx_segnalazioni_distributore ON segnalazioni_utenti (distributore_id, created_at DESC);

-- Indice per rate limiting per IP
CREATE INDEX idx_segnalazioni_ip ON segnalazioni_utenti (ip_hash, created_at DESC);
