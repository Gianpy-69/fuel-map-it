/**
 * Genera icone Android adaptive da icon.svg
 * Usa sharp per convertire SVG → PNG in tutte le densità
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICON_SVG = path.join(__dirname, '..', 'public', 'icon.svg');
const RES_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android mipmap densities
const DENSITIES = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192
};

// Foreground size for adaptive icons (108dp * density)
const ADAPTIVE_DENSITIES = {
    'mipmap-mdpi':    108,
    'mipmap-hdpi':    162,
    'mipmap-xhdpi':   216,
    'mipmap-xxhdpi':  324,
    'mipmap-xxxhdpi': 432
};

async function generateIcons() {
    const svgBuffer = fs.readFileSync(ICON_SVG);

    for (const [folder, size] of Object.entries(DENSITIES)) {
        const dir = path.join(RES_DIR, folder);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Standard launcher icon
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(path.join(dir, 'ic_launcher.png'));

        // Round launcher icon
        const roundedMask = Buffer.from(
            `<svg width="${size}" height="${size}">
                <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
            </svg>`
        );

        await sharp(svgBuffer)
            .resize(size, size)
            .composite([{
                input: roundedMask,
                blend: 'dest-in'
            }])
            .png()
            .toFile(path.join(dir, 'ic_launcher_round.png'));

        console.log(`✅ ${folder}: ${size}x${size}px`);
    }

    // Adaptive icon foreground
    for (const [folder, size] of Object.entries(ADAPTIVE_DENSITIES)) {
        const dir = path.join(RES_DIR, folder);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Create foreground with padding (icon centered in 108dp canvas, icon = 66dp)
        const iconSize = Math.round(size * 66 / 108);
        const padding = Math.round((size - iconSize) / 2);

        // Extract just the icon path (white part) on transparent background
        const fgSvg = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${iconSize}" height="${iconSize}">
                <path fill="#FFFFFF" d="M144 112h144c17.7 0 32 14.3 32 32v224h16c8.8 0 16 7.2 16 16s-7.2 16-16 16H96c-8.8 0-16-7.2-16-16s7.2-16 16-16h16V144c0-17.7 14.3-32 32-32zm16 64v80h112v-80H160zm208-48c0-8.8 7.2-16 16-16s16 7.2 16 16v128c0 26.5 21.5 48 48 48s48-21.5 48-48v-80c0-8.8-7.2-16-16-16s-16 7.2-16 16v80c0 8.8-7.2 16-16 16s-16-7.2-16-16V128c0-26.5-21.5-48-48-48s-48 21.5-48 48v80c0 8.8 7.2 16 16 16s16-7.2 16-16v-80z"/>
            </svg>`
        );

        await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
            .composite([{
                input: await sharp(fgSvg).resize(iconSize, iconSize).png().toBuffer(),
                left: padding,
                top: padding
            }])
            .png()
            .toFile(path.join(dir, 'ic_launcher_foreground.png'));

        console.log(`✅ ${folder} foreground: ${size}x${size}px`);
    }

    // Splash icon (centered, 288px for xxhdpi)
    const splashDir = path.join(RES_DIR, 'drawable');
    if (!fs.existsSync(splashDir)) fs.mkdirSync(splashDir, { recursive: true });

    console.log('\n🎉 Icone generate con successo!');
}

generateIcons().catch(err => {
    console.error('Errore:', err.message);
    process.exit(1);
});
