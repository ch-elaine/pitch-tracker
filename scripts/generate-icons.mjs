/**
 * Generates the PWA icon set with zero dependencies (Node's zlib + a hand-rolled
 * PNG encoder). Design: a transgender-pride-flag field (light blue / pink /
 * white / pink / light blue stripes) with five indigo "pitch bars" — matching
 * the app's pitch/volume graphs. Run with `npm run icons`.
 */
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// Transgender pride flag, top → bottom (5 equal horizontal stripes).
const TRANS_BLUE = [91, 206, 250]; // #5BCEFA
const TRANS_PINK = [245, 169, 184]; // #F5A9B8
const TRANS_WHITE = [255, 255, 255];
const FLAG_STRIPES = [TRANS_BLUE, TRANS_PINK, TRANS_WHITE, TRANS_PINK, TRANS_BLUE];

// Indigo bars contrast against every stripe (including the white one).
const BAR = [49, 46, 129]; // indigo-800
const BAR_HEIGHTS = [0.45, 0.72, 1.0, 0.62, 0.5];

// ---- minimal PNG encoder (RGBA, 8-bit) -----------------------------------
function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing --------------------------------------------------------------
function renderIcon(size, pad) {
  const rgba = Buffer.alloc(size * size * 4);
  // Background: horizontal trans-flag stripes.
  for (let y = 0; y < size; y++) {
    const stripe = FLAG_STRIPES[Math.min(FLAG_STRIPES.length - 1, Math.floor((y / size) * FLAG_STRIPES.length))];
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      rgba[i] = stripe[0];
      rgba[i + 1] = stripe[1];
      rgba[i + 2] = stripe[2];
      rgba[i + 3] = 255;
    }
  }

  const fillRect = (x0, y0, w, h, color) => {
    for (let y = Math.round(y0); y < Math.round(y0 + h); y++) {
      for (let x = Math.round(x0); x < Math.round(x0 + w); x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const i = (y * size + x) * 4;
        rgba[i] = color[0];
        rgba[i + 1] = color[1];
        rgba[i + 2] = color[2];
        rgba[i + 3] = 255;
      }
    }
  };

  const inner = size * (1 - 2 * pad);
  const x0 = size * pad;
  const y0 = size * pad;
  const n = BAR_HEIGHTS.length;
  const gap = inner * 0.06;
  const barW = (inner - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const barH = inner * BAR_HEIGHTS[i];
    const bx = x0 + i * (barW + gap);
    const by = y0 + (inner - barH) / 2;
    fillRect(bx, by, barW, barH, BAR);
  }
  return encodePng(size, size, rgba);
}

// ---- output ---------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  { name: 'icon-192.png', size: 192, pad: 0.16 },
  { name: 'icon-512.png', size: 512, pad: 0.16 },
  { name: 'maskable-512.png', size: 512, pad: 0.22 }, // extra safe-zone padding
  { name: 'apple-touch-icon.png', size: 180, pad: 0.16 },
];
for (const t of targets) {
  writeFileSync(join(OUT_DIR, t.name), renderIcon(t.size, t.pad));
  console.log(`wrote icons/${t.name} (${t.size}x${t.size})`);
}
