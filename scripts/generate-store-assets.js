const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICON_SVG = path.join(__dirname, '..', 'public', 'icon.svg');
const OUT_DIR = path.join(__dirname, '..', 'store-assets');

async function generateStoreAssets() {
    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    console.log('🎨 Generazione asset per Google Play Store...');

    // 1. Icona 512x512 PNG
    await sharp(ICON_SVG)
        .resize(512, 512)
        .png()
        .toFile(path.join(OUT_DIR, 'playstore-icon-512.png'));
    console.log('✅ Icona Play Store 512x512 creata!');

    // 2. Feature Graphic (Grafica delle funzioni) 1024x500 PNG
    const bannerSvg = Buffer.from(`
        <svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0F172A"/>
                    <stop offset="50%" stop-color="#1E293B"/>
                    <stop offset="100%" stop-color="#022C22"/>
                </linearGradient>
                <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#10B981" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#059669" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <rect width="1024" height="500" fill="url(#bgGrad)"/>
            <circle cx="850" cy="150" r="300" fill="url(#glowGrad)"/>
            <circle cx="150" cy="400" r="250" fill="url(#glowGrad)"/>

            <!-- App Logo Badge -->
            <g transform="translate(140, 160)">
                <rect width="180" height="180" rx="36" fill="#10B981"/>
                <path fill="#FFFFFF" transform="scale(0.35) translate(0, 0)" d="M144 112h144c17.7 0 32 14.3 32 32v224h16c8.8 0 16 7.2 16 16s-7.2 16-16 16H96c-8.8 0-16-7.2-16-16s7.2-16 16-16h16V144c0-17.7 14.3-32 32-32zm16 64v80h112v-80H160zm208-48c0-8.8 7.2-16 16-16s16 7.2 16 16v128c0 26.5 21.5 48 48 48s48-21.5 48-48v-80c0-8.8-7.2-16-16-16s-16 7.2-16 16v80c0 8.8-7.2 16-16 16s-16-7.2-16-16V128c0-26.5-21.5-48-48-48s-48 21.5-48 48v80c0 8.8 7.2 16 16 16s16-7.2 16-16v-80z"/>
            </g>

            <!-- Testi Banner -->
            <text x="360" y="225" font-family="-apple-system, system-ui, BlinkMacSystemFont, Segoe UI, Roboto" font-size="52" font-weight="800" fill="#FFFFFF">Fuel Map Italia</text>
            <text x="360" y="280" font-family="-apple-system, system-ui, BlinkMacSystemFont, Segoe UI, Roboto" font-size="24" font-weight="600" fill="#10B981">Prezzi Carburanti MIMIT • Mappa &amp; Pit-Stop</text>
            <text x="360" y="320" font-family="-apple-system, system-ui, BlinkMacSystemFont, Segoe UI, Roboto" font-size="18" font-weight="400" fill="#94A3B8">Oltre 23.800 distributori in tutta Italia • Risparmio garantito</text>
        </svg>
    `);

    await sharp(bannerSvg)
        .png()
        .toFile(path.join(OUT_DIR, 'playstore-feature-graphic-1024x500.png'));
    console.log('✅ Feature Graphic 1024x500 creata!');

    // 3. File con testi pronti per Google Play Console
    const storeTexts = `# 📋 Testi Pronti per la Scheda Google Play Store

## Nome App (Max 30 caratteri)
Fuel Map Italia — Prezzi Pompa

## Breve Descrizione (Max 80 caratteri)
Mappa distributori e prezzi carburanti MIMIT in tempo reale in tutta Italia.

## Descrizione Completa (Max 4000 caratteri)
Trova i distributori di carburante più economici vicino a te o lungo il tuo viaggio in tutta Italia!

Fuel Map Italia raccoglie quotidianamente i dati ufficiali certificati dal Ministero delle Imprese e del Made in Italy (MIMIT), mostrandoti prezzi aggiornati, disponibilità e convenienza di oltre 23.800 stazioni di servizio (Benzina, Diesel, GPL e Metano).

Perché scegliere Fuel Map Italia:
⭐ Prezzi Ufficiali Aggiornati: Dati certificati MIMIT ogni giorno per evitare sorprese alla pompa.
🎯 Pit-Stop Planner Viaggio: Inserisci partenza e destinazione (es. Roma ➔ Milano): l'app calcola la sosta più economica lungo la rotta prima che finisca l'autonomia.
🔔 Radar Notifiche di Prossimità: Ricevi un avviso discreto quando ti avvicini a una pompa conveniente entro 1.5 km.
📈 Storico Prezzi 7 Giorni: Grafico interattivo per capire l'andamento settimanale dei prezzi di ciascuna stazione.
💰 Calcolatore Risparmio: Seleziona la capienza del tuo serbatoio e scopri subito quanto risparmi rispetto alla media della zona.
🔍 Ricerca Rapida: Trova qualsiasi via, piazza o città con suggerimenti istantanei.
🌙 Guida Notturna & Vista Satellite: Mappa scura anti-abbagliamento per guidare di notte in totale sicurezza.
👥 Crowdsourcing & Segnalazioni: Segnala code, pompe chiuse o prezzi non aggiornati con foto per aiutare gli altri automobilisti.

Zero login o registrazioni obbligatorie: apri l'app e trova subito il distributore migliore per fare il pieno risparmiando!

---
Link Informativa Privacy: https://fuel-map-it.onrender.com/privacy.html
Email Supporto: gianpidandrea@gmail.com
`;

    fs.writeFileSync(path.join(OUT_DIR, 'playstore-scheda-testi.md'), storeTexts, 'utf8');
    console.log('✅ Testi scheda Play Store generati in store-assets/playstore-scheda-testi.md!');
}

generateStoreAssets().catch(err => {
    console.error('Errore:', err);
    process.exit(1);
});
