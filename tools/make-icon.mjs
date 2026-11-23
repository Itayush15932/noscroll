// Draws the 1024x1024 app icon as a PNG, with no outside libraries.
// Run: node tools/make-icon.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 1024;
const SS = 3; // samples per axis for smooth edges

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'NoScroll', 'Assets.xcassets', 'AppIcon.appiconset', 'icon-1024.png');

const mix = (a, b, t) => a + (b - a) * t;
const TOP = [38, 30, 92];
const BOTTOM = [122, 40, 138];
const WHITE = [255, 255, 255];

function background(y) {
  const t = y / SIZE;
  return [mix(TOP[0], BOTTOM[0], t), mix(TOP[1], BOTTOM[1], t), mix(TOP[2], BOTTOM[2], t)];
}

// Signed distance to a rounded square centered on the icon.
function roundedBox(x, y, half, radius) {
  const dx = Math.abs(x - SIZE / 2) - (half - radius);
  const dy = Math.abs(y - SIZE / 2) - (half - radius);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - radius;
}

function inTriangle(px, py, a, b, c) {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const p = [px, py];
  const d1 = s(p, a, b);
  const d2 = s(p, b, c);
  const d3 = s(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

// Distance from a point to the segment a-b.
function segmentDistance(px, py, a, b) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (a[0] + vx * t), py - (a[1] + vy * t));
}

const PLAY = [[430, 372], [430, 652], [668, 512]];
const SLASH_A = [300, 724];
const SLASH_B = [724, 300];

function sample(x, y) {
  const bg = background(y);

  // The slash, with a gap of background colour around it.
  const slash = segmentDistance(x, y, SLASH_A, SLASH_B);
  if (slash <= 22) { return WHITE; }
  if (slash <= 50) { return bg; }

  // Frame: a rounded square outline.
  const frame = roundedBox(x, y, 300, 96);
  if (frame <= 0 && frame >= -40) { return WHITE; }

  // Play triangle.
  if (inTriangle(x, y, PLAY[0], PLAY[1], PLAY[2])) { return WHITE; }

  return bg;
}

const raw = Buffer.alloc(SIZE * (1 + SIZE * 3));
for (let y = 0; y < SIZE; y++) {
  const row = y * (1 + SIZE * 3);
  raw[row] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
        r += c[0]; g += c[1]; b += c[2];
      }
    }
    const n = SS * SS;
    const i = row + 1 + x * 3;
    raw[i] = Math.round(r / n);
    raw[i + 1] = Math.round(g / n);
    raw[i + 2] = Math.round(b / n);
  }
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) { c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8;  // bit depth
header[9] = 2;  // colour type: RGB, no transparency
header[10] = 0;
header[11] = 0;
header[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log('icon written:', out, png.length, 'bytes');
