#!/usr/bin/env node
/**
 * Generates minimal valid PNG icons for the ZenMix PWA.
 * Pure Node.js – no external dependencies.
 *
 * Usage:  node scripts/generate-icons.mjs
 * Output: public/icon-192.png  public/icon-512.png
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// ── CRC-32 (IEEE) ────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG chunk builder ────────────────────────────────────────────────────────
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crcBuf]);
}

// ── PNG generator ────────────────────────────────────────────────────────────
function createPNG(size, colors) {
  // Build raw RGBA scanlines (filter byte 0x00 = None per row)
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const color = colors(x, y, size);
      const off = 1 + x * 4;
      row[off] = color[0];
      row[off + 1] = color[1];
      row[off + 2] = color[2];
      row[off + 3] = color[3];
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Color functions: gradient circle on dark bg ──────────────────────────────
function iconColor(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= r) {
    // Sage gradient inside circle
    const t = dist / r;
    return [
      Math.round(132 + (100 - 132) * t), // R
      Math.round(161 + (130 - 161) * t), // G
      Math.round(131 + (110 - 131) * t), // B
      255,
    ];
  } else if (dist <= r + 3) {
    // Thin white ring
    return [255, 255, 255, 200];
  } else {
    // Dark sage background
    return [26, 36, 26, 255];
  }
}

// ── Generate ─────────────────────────────────────────────────────────────────
if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

console.log('Generating PWA icons…');

writeFileSync(join(publicDir, 'icon-192.png'), createPNG(192, iconColor));
console.log('  ✓ public/icon-192.png');

writeFileSync(join(publicDir, 'icon-512.png'), createPNG(512, iconColor));
console.log('  ✓ public/icon-512.png');

console.log('Done.');
