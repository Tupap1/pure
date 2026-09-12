// Genera los íconos PWA (192, 512, 192-maskable) como PNG estáticos porque next/og
// (@vercel/og) revienta con "TypeError: Invalid URL" en Windows: su código compilado hace
// fs.readFileSync(fileURLToPath(join(import.meta.url, "../noto-sans-v27-latin-regular.ttf")))
// usando path.join (separador \ en Windows) sobre una URL file://, lo que produce una URL
// inválida. Reproducible con solo construir un ImageResponse, sin importar el contenido.
//
// El mismo diseño visual se usa en app/apple-icon.png (180px estático, generado por un script
// anterior): fondo #191919, "P" geométrica en #e9e9e7 dibujada como bloques (sin fuente).
// Esta versión parametriza por tamaño y escala del glifo para generar los tres variantes.
// Se codifican como PNG válidos con zlib (nativo de Node), sin librerías externas.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x19, 0x19, 0x19];
const FG = [0xe9, 0xe9, 0xe7];

// Geometría original en lienzo de 180×180, centrada en (90, 90)
const ORIGINAL_STEM = [66, 52, 84, 128];     // [x0, y0, x1, y1]
const ORIGINAL_BOWL = [66, 52, 116, 92];
const ORIGINAL_COUNTER = [84, 62, 106, 82];

// --- Codificador PNG mínimo (sin dependencias) ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgbBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: truecolor RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk('IHDR', ihdrData);

  // Cada scanline: 1 byte de filtro (0 = None) + width*3 bytes RGB.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    rgbBuffer.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk('IDAT', compressed);

  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// --- Generador de íconos parametrizados ---

function transformRect(rect, size, glyphScale) {
  const k = (size / 180) * glyphScale;
  const c = size / 2;

  const [x0, y0, x1, y1] = rect;
  const tx0 = Math.round(c + (x0 - 90) * k);
  const ty0 = Math.round(c + (y0 - 90) * k);
  const tx1 = Math.round(c + (x1 - 90) * k);
  const ty1 = Math.round(c + (y1 - 90) * k);

  return [tx0, ty0, tx1, ty1];
}

function fillRect(pixels, size, x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * size + x) * 3;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
    }
  }
}

function generateIcon(size, glyphScale, filename) {
  // Buffer RGB plano, fondo sólido
  const pixels = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = BG[0];
    pixels[i * 3 + 1] = BG[1];
    pixels[i * 3 + 2] = BG[2];
  }

  // Transforma rectángulos según tamaño y escala
  const stem = transformRect(ORIGINAL_STEM, size, glyphScale);
  const bowl = transformRect(ORIGINAL_BOWL, size, glyphScale);
  const counter = transformRect(ORIGINAL_COUNTER, size, glyphScale);

  // Dibuja en orden: vástago, panza, contraforma (hueco)
  fillRect(pixels, size, stem[0], stem[1], stem[2], stem[3], FG);
  fillRect(pixels, size, bowl[0], bowl[1], bowl[2], bowl[3], FG);
  fillRect(pixels, size, counter[0], counter[1], counter[2], counter[3], BG);

  // Codifica y escribe PNG
  const png = encodePng(size, size, pixels);
  const outPath = path.resolve(__dirname, '..', 'public', 'icons', filename);
  fs.writeFileSync(outPath, png);

  // Imprime verificación de rectángulos y tamaño del archivo
  console.log(
    `${filename.padEnd(30)} stem ${stem[0].toString().padStart(3)} ${stem[1].toString().padStart(3)} ${stem[2].toString().padStart(3)} ${stem[3].toString().padStart(3)} | ` +
    `bowl ${bowl[0].toString().padStart(3)} ${bowl[1].toString().padStart(3)} ${bowl[2].toString().padStart(3)} ${bowl[3].toString().padStart(3)} | ` +
    `counter ${counter[0].toString().padStart(3)} ${counter[1].toString().padStart(3)} ${counter[2].toString().padStart(3)} ${counter[3].toString().padStart(3)} | ` +
    `${png.length} bytes`
  );
}

// --- Genera los tres íconos ---

// Crea la carpeta public/icons si no existe
const iconsDir = path.resolve(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generando íconos PWA estáticos...\n');
generateIcon(192, 1, 'icon-192.png');
generateIcon(512, 1, 'icon-512.png');
generateIcon(192, 0.7, 'icon-192-maskable.png');
console.log('\nOK.');
