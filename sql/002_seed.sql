-- ============================================
-- Fuel Map Italia — Dati di test (zona Roma)
-- ============================================

INSERT INTO distributori (nome, indirizzo, comune, provincia, posizione, bandiera, self_service) VALUES
('ENI Via Tuscolana',       'Via Tuscolana 120',        'Roma', 'RM', ST_MakePoint(12.5150, 41.8780)::geography, 'ENI',    true),
('Q8 Piazza Bologna',      'Piazza Bologna 5',         'Roma', 'RM', ST_MakePoint(12.5170, 41.9100)::geography, 'Q8',     true),
('IP Tiburtina',            'Via Tiburtina 340',        'Roma', 'RM', ST_MakePoint(12.5320, 41.9050)::geography, 'IP',     true),
('Tamoil Prenestina',      'Via Prenestina 78',        'Roma', 'RM', ST_MakePoint(12.5280, 41.8920)::geography, 'Tamoil', false),
('TotalErg Appia',         'Via Appia Nuova 200',      'Roma', 'RM', ST_MakePoint(12.5100, 41.8650)::geography, 'Total',  true),
('ENI EUR',                'Viale Europa 50',          'Roma', 'RM', ST_MakePoint(12.4680, 41.8310)::geography, 'ENI',    true),
('Agip Ostia',             'Via del Mare 400',         'Roma', 'RM', ST_MakePoint(12.2890, 41.7350)::geography, 'Agip',   true),
('Q8 Trastevere',          'Viale Trastevere 180',     'Roma', 'RM', ST_MakePoint(12.4710, 41.8810)::geography, 'Q8',     true),
('IP Nomentana',           'Via Nomentana 250',        'Roma', 'RM', ST_MakePoint(12.5130, 41.9200)::geography, 'IP',     false),
('Shell Flaminia',         'Via Flaminia 90',          'Roma', 'RM', ST_MakePoint(12.4750, 41.9350)::geography, 'Shell',  true);

-- Stato operativo iniziale per ogni distributore
INSERT INTO stato_operativo (distributore_id, stato, benzina_disponibile, diesel_disponibile, gpl_disponibile, metano_disponibile, prezzo_benzina, prezzo_diesel, livello_coda)
VALUES
(1,  'aperto',      true,  true,  false, false, 1.879, 1.769, 0),
(2,  'aperto',      true,  true,  true,  false, 1.899, 1.789, 1),
(3,  'parziale',    true,  false, false, false, 1.859, NULL,  0),
(4,  'chiuso',      false, false, false, false, NULL,  NULL,  0),
(5,  'aperto',      true,  true,  true,  true,  1.849, 1.759, 2),
(6,  'aperto',      true,  true,  false, false, 1.889, 1.779, 0),
(7,  'sconosciuto', true,  true,  false, false, 1.869, 1.749, 0),
(8,  'aperto',      true,  true,  false, false, 1.909, 1.799, 1),
(9,  'parziale',    false, true,  false, false, NULL,  1.769, 0),
(10, 'aperto',      true,  true,  true,  false, 1.859, 1.749, 0);
