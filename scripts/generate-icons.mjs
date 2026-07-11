// Script para generar iconos PNG en todos los tamaños desde el SVG
// Ejecutar: node scripts/generate-icons.mjs
// Requiere: sharp (ya instalado como dependencia transitiva de next)

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  try {
    const sharp = (await import('sharp')).default;
    const svgBuffer = readFileSync(join(iconsDir, 'icon.svg'));

    for (const size of sizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(join(iconsDir, `icon-${size}x${size}.png`));

      console.log(`✅ Generado: icon-${size}x${size}.png`);
    }

    // También generar el favicon
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(join(__dirname, '..', 'src', 'app', 'favicon.ico'));

    console.log('✅ favicon.ico generado');
    console.log('\n🎉 Todos los iconos generados exitosamente!');
  } catch (error) {
    console.error('Error generando iconos:', error.message);
    console.log('\n📝 Alternativa: Usa un conversor online como realfavicongenerator.net');
    console.log('   Sube el archivo public/icons/icon.svg y descarga los PNGs');
  }
}

generateIcons();
