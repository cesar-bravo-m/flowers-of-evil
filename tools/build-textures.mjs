// Generates the site's textures, with no dependencies and no network:
//
//   assets/paper.png            a seamless paper-grain tile, laid over the
//                               share card that share.js paints on a canvas
//   assets/burnt-edge.png       that card's burnt edge, drawn as a 9-slice
//                               frame the way a CSS border-image would be
//   assets/burnt-edge-dark.png  the same for the dark theme
//
// The burnt edge could have been an SVG filter (feTurbulence + feDisplacementMap +
// feMorphology) run over the whole card, but on a long card that is far too
// slow. A sliced tile costs nothing at render time: the painter draws four
// corners and repeats four edge strips. So the tear, the char rim, the
// scorch fading in from it, a soft shadow outside it, and the paper grain are
// all baked into one tile here. The tile is TILE px square and is sliced at
// SLICE px, so an edge strip is TILE - 2*SLICE px long; every noise that shapes
// the edge is periodic with that length, which is what lets the strip repeat
// without a seam. The grain is baked into the paper part of the tile with the
// same generator as paper.png, so where the tile meets the card's own
// background there is no change of texture to see.
//
//   node tools/build-textures.mjs              writes the three files
//   node tools/build-textures.mjs preview.png  also writes an opaque preview of
//                                              the light tile over the site
//                                              colour
//
// Deterministic: seeds are fixed, so re-running gives the same bytes.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TILE = 384;
const SLICE = 96;                 // must match EDGE_SLICE in share.js
const GRAIN_STRENGTH = 0.13;      // peak alpha of the grain

// --- deterministic PRNG (mulberry32) ---
let state = 0;
function seed(s) { state = s >>> 0; }
function rand() {
  state = (state + 0x6D2B79F5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// --- value noise on a lattice of `freq` cells that wraps at the tile edge.
//     Its period is TILE / freq, so with an even freq it also repeats every
//     TILE / 2 = TILE - 2 * SLICE px, which the edge strips need. ---
function valueNoise(freq) {
  const lattice = new Float32Array(freq * freq);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand() * 2 - 1;
  const cell = TILE / freq;
  const smooth = (t) => t * t * (3 - 2 * t);
  const out = new Float32Array(TILE * TILE);
  for (let y = 0; y < TILE; y++) {
    const gy = y / cell, y0 = Math.floor(gy), y1 = (y0 + 1) % freq, ty = smooth(gy - y0);
    for (let x = 0; x < TILE; x++) {
      const gx = x / cell, x0 = Math.floor(gx), x1 = (x0 + 1) % freq, tx = smooth(gx - x0);
      const a = lattice[y0 * freq + x0], b = lattice[y0 * freq + x1];
      const c = lattice[y1 * freq + x0], d = lattice[y1 * freq + x1];
      out[y * TILE + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

function fractal(octaves) {
  const field = new Float32Array(TILE * TILE);
  for (const [freq, amp] of octaves) {
    const n = valueNoise(freq);
    for (let i = 0; i < field.length; i++) field[i] += n[i] * amp;
  }
  return field;
}

// --- the paper grain: broad mottle down to fine tooth, per-pixel grain, and a
//     few faint fibres drawn modulo the tile ---
function grainField() {
  seed(0x5eed);
  const field = fractal([[6, 0.20], [12, 0.22], [24, 0.28], [48, 0.32], [96, 0.34], [192, 0.32]]);
  for (let i = 0; i < field.length; i++) field[i] += (rand() * 2 - 1) * 0.45;
  for (let f = 0; f < 140; f++) {
    let x = rand() * TILE, y = rand() * TILE, angle = rand() * Math.PI * 2;
    const len = 8 + rand() * 28;
    const tone = (rand() < 0.65 ? -1 : 1) * (0.3 + rand() * 0.45);
    for (let s = 0; s < len; s++) {
      angle += (rand() - 0.5) * 0.35;
      x += Math.cos(angle); y += Math.sin(angle);
      const px = ((Math.round(x) % TILE) + TILE) % TILE;
      const py = ((Math.round(y) % TILE) + TILE) % TILE;
      field[py * TILE + px] += tone;
    }
  }
  return field;
}

// grain value -> [grey 0|255, alpha 0..1]; the same mapping in every file
function grainPixel(v) {
  const g = Math.max(-1, Math.min(1, v * 0.55));
  return [g > 0 ? 255 : 0, Math.abs(g) * GRAIN_STRENGTH];
}

// --- PNG writer (8-bit; colour type 4 = grey+alpha, 6 = RGBA, 2 = RGB) ---
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height, colourType, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = colourType; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const grain = grainField();

// ---------------------------------------------------------------- paper.png
{
  const rows = Buffer.alloc((1 + TILE * 2) * TILE);
  let p = 0;
  for (let y = 0; y < TILE; y++) {
    rows[p++] = 0;
    for (let x = 0; x < TILE; x++) {
      const [g, a] = grainPixel(grain[y * TILE + x]);
      rows[p++] = g;
      rows[p++] = Math.round(a * 255);
    }
  }
  const bytes = png(TILE, TILE, 4, rows);
  writeFileSync(join(root, 'assets', 'paper.png'), bytes);
  console.log(`wrote assets/paper.png (${TILE}x${TILE}, ${(bytes.length / 1024).toFixed(1)} KB)`);
}

// ---------------------------------------------------------- burnt-edge*.png
// Fields shaping the edge. Even frequencies only: see valueNoise().
seed(0xb0b0);
const tearNoise = fractal([[2, 0.22], [4, 0.28], [8, 0.30], [16, 0.24], [32, 0.18], [64, 0.12]]);
const biteNoise = fractal([[16, 0.5], [32, 0.35], [64, 0.25]]);   // the deeper notches
const charNoise = fractal([[4, 0.35], [8, 0.3], [16, 0.25], [32, 0.2], [64, 0.15]]);

const smoothstep = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const mix = (a, b, t) => a + (b - a) * t;

function burntTile({ paper, char, ember, shadowAlpha, withGrain }) {
  const px = new Float32Array(TILE * TILE * 4); // premultiplied RGBA, 0..1
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      // inward distance from the box edge; the middle slice (d >= SLICE) is
      // never drawn, so leave it empty and let it compress away
      const d = Math.min(x, y, TILE - 1 - x, TILE - 1 - y) + 0.5;
      if (d >= SLICE) continue;
      // the torn edge, 5..26 px in: a ragged line with, where the bite noise
      // peaks, a notch eaten a few px deeper
      const bite = Math.max(0, biteNoise[i] - 0.35) * 8;
      const tear = 14 + tearNoise[i] * 9 + bite;
      const charW = 3 + (charNoise[i] + 1) * 3.5;      // char rim, 3..10 px wide
      const s = d - tear;                              // signed: + is into the paper
      const paperA = smoothstep(-0.6, 0.6, s);
      const charA = smoothstep(-charW - 1.2, -charW + 1.2, s) * (1 - paperA);
      const outside = Math.max(0, -(s + charW));
      const shadowA = shadowAlpha * Math.exp(-outside / 9) * (1 - Math.max(paperA, charA));
      // paper colour, scorched: a narrow near-black band and a wider ember
      // tint, both gone well before the middle slice so the card's own
      // background continues it without a seam
      const near = 0.85 * Math.exp(-Math.max(0, s) / 7);
      const wide = 0.32 * Math.exp(-Math.max(0, s) / 20);
      let r = mix(paper[0], ember[0], wide), g = mix(paper[1], ember[1], wide), b = mix(paper[2], ember[2], wide);
      r = mix(r, char[0], near); g = mix(g, char[1], near); b = mix(b, char[2], near);
      if (withGrain) {
        const [gg, ga] = grainPixel(grain[i]);
        r = mix(r, gg, ga); g = mix(g, gg, ga); b = mix(b, gg, ga);
      }
      // composite: shadow, then char, then paper (premultiplied over)
      let R = 0, G = 0, B = 0, A = 0;
      const over = (cr, cg, cb, ca) => {
        R = cr * ca + R * (1 - ca); G = cg * ca + G * (1 - ca); B = cb * ca + B * (1 - ca); A = ca + A * (1 - ca);
      };
      over(0, 0, 0, shadowA);
      over(char[0] / 255, char[1] / 255, char[2] / 255, charA);
      over(r / 255, g / 255, b / 255, paperA);
      px[i * 4] = R; px[i * 4 + 1] = G; px[i * 4 + 2] = B; px[i * 4 + 3] = A;
    }
  }
  const rows = Buffer.alloc((1 + TILE * 4) * TILE);
  let p = 0;
  for (let y = 0; y < TILE; y++) {
    rows[p++] = 0;
    for (let x = 0; x < TILE; x++) {
      const i = (y * TILE + x) * 4, A = px[i + 3];
      // un-premultiply for PNG
      rows[p++] = A > 0 ? Math.round(Math.min(1, px[i] / A) * 255) : 0;
      rows[p++] = A > 0 ? Math.round(Math.min(1, px[i + 1] / A) * 255) : 0;
      rows[p++] = A > 0 ? Math.round(Math.min(1, px[i + 2] / A) * 255) : 0;
      rows[p++] = Math.round(A * 255);
    }
  }
  return rows;
}

const light = burntTile({
  paper: [255, 255, 255], char: [42, 26, 16], ember: [138, 90, 42],
  shadowAlpha: 0.28, withGrain: true,
});
const dark = burntTile({
  paper: [39, 34, 29], char: [8, 5, 3], ember: [70, 44, 24],
  shadowAlpha: 0.45, withGrain: false, // the dark theme has no grain
});
for (const [name, rows] of [['burnt-edge.png', light], ['burnt-edge-dark.png', dark]]) {
  const bytes = png(TILE, TILE, 6, rows);
  writeFileSync(join(root, 'assets', name), bytes);
  console.log(`wrote assets/${name} (${TILE}x${TILE}, slice ${SLICE}, ${(bytes.length / 1024).toFixed(1)} KB)`);
}

// Optional opaque preview: the light tile over the site colour, so the tear,
// the char and the shadow can be checked by eye.
const previewPath = process.argv[2];
if (previewPath) {
  const bg = [0xe4, 0xe7, 0xeb];
  const raw = Buffer.alloc((1 + TILE * 3) * TILE);
  let q = 0;
  for (let y = 0; y < TILE; y++) {
    raw[q++] = 0;
    for (let x = 0; x < TILE; x++) {
      const i = (1 + TILE * 4) * y + 1 + x * 4;
      const a = light[i + 3] / 255;
      for (let c = 0; c < 3; c++) raw[q++] = Math.round(bg[c] * (1 - a) + light[i + c] * a);
    }
  }
  writeFileSync(previewPath, png(TILE, TILE, 2, raw));
  console.log(`wrote preview ${previewPath}`);
}
