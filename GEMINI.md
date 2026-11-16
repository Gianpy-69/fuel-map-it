# Fuel Map Italia — Convenzioni Progetto

## Stack
- Backend: Node.js + Express
- Database: PostgreSQL 15 + PostGIS 3.4 (via Docker su porta 5434)
- Frontend: HTML/CSS/JS puro + Leaflet 1.9
- Font: Inter | Spaziatura: base 8px | Accento: #0066FF

## Docker
- Container: fuelmap-db
- Porta host: 5434 (non 5432, occupata da PostgreSQL locale)
- DB: fuelmap | User: fuelmap_user | Password: fuelmap_secret

## Struttura
- server/ → backend Express (index.js, db.js, routes/, middleware/)
- public/ → frontend statico (index.html, css/, js/)
- sql/ → script SQL numerati (001_schema.sql, 002_seed.sql)

## Convenzioni
- Segnalazioni anonime (session_id + IP hash, no login)
- Rate limiting: 10 segnalazioni/ora per IP
- Validazione prossimità: max 500m dal distributore per segnalare
- Coordinate Italia: lat 35.5–47.1, lon 6.6–18.5
