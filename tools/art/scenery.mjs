// Seamless parallax backgrounds, ground tiles, title art, logo and UI icons.
import { Pix, C, mix, lighten, darken } from './pix.mjs';

// Deterministic helpers -------------------------------------------------------
function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16));

// Wrap-aware helpers so layers tile seamlessly.
function wrapDo(W, x, fn) {
  fn(x);
  fn(x - W);
  fn(x + W);
}

// Dithered vertical gradient between a list of colors.
function gradient(p, colors, y0 = 0, y1 = p.h) {
  const n = colors.length - 1;
  for (let y = y0; y < y1; y += 1) {
    const t = ((y - y0) / Math.max(1, y1 - y0 - 1)) * n;
    const base = Math.min(n - 1, Math.floor(t));
    const frac = Math.min(1, t - base);
    for (let x = 0; x < p.w; x += 1) {
      const c = frac > BAYER[y % 4][x % 4] ? colors[base + 1] : colors[base];
      p.set(x, y, c);
    }
  }
}

// Periodic mountain range: integer frequencies keep the layer seamless.
function ridge(p, W, color, baseY, amp, seed, peaky = false) {
  const pts = [];
  for (let x = 0; x <= W; x += 2) {
    const u = x / W;
    let h;
    if (peaky) {
      const s = Math.abs(Math.sin(Math.PI * (3 * u + seed * 0.1)));
      h = 0.6 * (1 - s) + 0.3 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (7 * u + seed)));
    } else {
      h = 0.5 + 0.3 * Math.sin(2 * Math.PI * (2 * u + seed)) + 0.2 * Math.sin(2 * Math.PI * (5 * u + seed * 0.7));
    }
    pts.push([x, baseY - amp * h]);
  }
  pts.push([W, p.h]);
  pts.push([0, p.h]);
  for (const shift of [-W, 0, W]) {
    p.poly(pts.map(([x, y]) => [x + shift, y]), color);
  }
}

// Evenly spaced objects with seeded variation (wraps at W).
function row(p, W, count, fn, seed = 1) {
  for (let i = 0; i < count; i += 1) {
    const x = Math.round((i + hash(seed * 31 + i) * 0.4) * (W / count));
    const r = hash(seed * 17 + i * 7 + 3);
    wrapDo(W, x, (xx) => fn(xx, r, i));
  }
}

function pineTree(p, x, base, h, col, trunk) {
  const w = Math.max(3, Math.round(h * 0.38));
  p.poly([[x, base - h], [x + w / 2, base], [x - w / 2, base]], col);
  p.poly([[x, base - h * 0.7], [x + w * 0.7, base - h * 0.2], [x - w * 0.7, base - h * 0.2]], col);
  p.rect(x - 1, base - 1, 2, 3, trunk);
}

function deadTree(p, x, base, h, col) {
  p.line(x, base, x, base - h, col, 2);
  for (let k = 0; k < 3; k += 1) {
    const yy = base - h * (0.4 + k * 0.2);
    p.line(x, yy, x + (k % 2 ? 6 : -6), yy - 5, col, 1);
  }
}

function castle(p, x, base, w, h, col, win) {
  p.rect(x, base - h, w, h, col);
  for (let k = 0; k < w; k += 3) p.rect(x + k, base - h - 2, 2, 2, col);
  p.rect(x + Math.floor(w / 2) - 1, base - h * 0.6, 2, 3, win);
  p.poly([[x + w * 0.2, base - h], [x + w * 0.5, base - h - 12], [x + w * 0.8, base - h]], col);
}

function house(p, x, base, w, h, col, roof, win) {
  p.rect(x, base - h, w, h, col);
  p.poly([[x - 2, base - h], [x + w / 2, base - h - w * 0.6], [x + w + 2, base - h]], roof);
  p.rect(x + w / 2 - 1, base - h + 3, 2, 3, win);
}

// Layers ------------------------------------------------------------------------
const ENV = {
  village: { sky: ['#1a1428', '#3a2442', '#6a3a5a', '#b06a6a'], far: '#3a2a4a', mid: '#1e1628', ground: ['#4a3a2a', '#3a2c20', '#5a4a34', '#6a5a3a'], accent: '#f4e8c0', ridge: '#2c2038' },
  forest: { sky: ['#0e1a16', '#1a3028', '#2a4a3a', '#4a6a4a'], far: '#1a3a24', mid: '#0c2016', ground: ['#2a3a1a', '#22301a', '#3a4a24', '#1a2a12'], accent: '#c8f0a0', ridge: '#14301c' },
  frost: { sky: ['#4a7aa8', '#7fb0d8', '#b8d8ec', '#e8f4ff'], far: '#9ac8e0', mid: '#e8f4ff', ground: ['#e8f4ff', '#c8dcec', '#f8fcff', '#b0c8dc'], accent: '#ffffff', ridge: '#7aa8c8' },
  fortress: { sky: ['#1a0606', '#3a0e0a', '#7a2a14', '#c05a20'], far: '#3a1414', mid: '#241010', ground: ['#4a3a3a', '#3a2a2a', '#5a4a4a', '#2a2020'], accent: '#ffb347', ridge: '#2a1010' },
  shadow: { sky: ['#06020c', '#120624', '#241040', '#3a1a5a'], far: '#1a0a2a', mid: '#0e0618', ground: ['#2a2040', '#1a1430', '#302850', '#14102a'], accent: '#c8a0ff', ridge: '#12061e' },
  desert: { sky: ['#e8a050', '#f6c27a', '#ffe2a8', '#fff4d8'], far: '#e0a060', mid: '#c88040', ground: ['#e8c080', '#d8a868', '#f4d89a', '#c89858'], accent: '#fff0c0', ridge: '#c08040' },
  sunken: { sky: ['#03182a', '#0a3a5a', '#1a6a8a', '#3a9ab0'], far: '#0e4a6a', mid: '#0a2a40', ground: ['#4a6a6a', '#3a5a5a', '#5a7a7a', '#2a4848'], accent: '#9af0ff', ridge: '#0a3450' },
  mountain: { sky: ['#2a1a4a', '#4a2a5a', '#a04a5a', '#ff9a5a'], far: '#4a3a6a', mid: '#2a2a40', ground: ['#5a4a4a', '#4a3a3a', '#6a5a5a', '#3a2e2e'], accent: '#ffd0a0', ridge: '#3a2a4a' },
  nightmare: { sky: ['#1a0624', '#3a0e4a', '#7a2a7a', '#c05ac0'], far: '#4a1a5a', mid: '#2a0a3a', ground: ['#4a1a3a', '#3a1430', '#5a2a4a', '#2a0a20'], accent: '#ff9af0', ridge: '#300a40' },
  celestial: { sky: ['#4a5ac8', '#8a9ae8', '#ffd8e8', '#fff2c8'], far: '#c8d0ff', mid: '#ffffff', ground: ['#f0e8d0', '#d8d0b0', '#ffffff', '#e8dcb0'], accent: '#ffe27a', ridge: '#b8c0f0' },
};

function stars(p, n, seed, color, maxY) {
  for (let i = 0; i < n; i += 1) {
    const x = Math.floor(hash(seed + i * 3) * p.w);
    const y = Math.floor(hash(seed + i * 3 + 1) * maxY);
    p.set(x, y, color);
  }
}

// Far layer: sky + distant silhouettes (seamless width W).
export function farLayer(env, W = 480, H = 240) {
  const e = ENV[env];
  const p = new Pix(W, H);
  gradient(p, e.sky.map(C));
  const sc = C(e.accent);
  if (env === 'village' || env === 'shadow' || env === 'nightmare') {
    stars(p, 40, 7, sc, H * 0.5);
    p.disc(W * 0.7, H * 0.2, 9, 9, C(e.accent));
    p.disc(W * 0.7 + 3, H * 0.2 - 2, 8, 8, C(e.sky[1]));
  }
  if (env === 'celestial') p.disc(W * 0.8, H * 0.22, 16, 16, C('#fff8d0'));
  if (env === 'desert') p.disc(W * 0.75, H * 0.2, 13, 13, C('#fff6d0'));
  if (env === 'frost') p.disc(W * 0.2, H * 0.15, 10, 10, C('#ffffff'));
  if (env === 'mountain') p.disc(W * 0.3, H * 0.6, 60, 60, C('#ff9a5a'));
  ridge(p, W, C(e.far), H * 0.72, 90, 0.3, env === 'mountain' || env === 'frost' || env === 'fortress');
  if (env === 'fortress') {
    for (let i = 0; i < 4; i += 1) p.rect(i * W / 4 + 20, H * 0.5, 2, 30, C('#ff8a3d'));
  }
  if (env === 'desert') ridge(p, W, C('#d89050'), H * 0.82, 26, 0.9, false);
  if (env === 'sunken') {
    for (let i = 0; i < 80; i += 1) p.set(hash(i * 5) * W, hash(i * 5 + 2) * H * 0.6, C('#7ef0ff'));
  }
  if (env === 'forest' || env === 'village') ridge(p, W, C(e.ridge), H * 0.8, 40, 0.6, false);
  if (env === 'nightmare') {
    for (let i = 0; i < 6; i += 1) p.disc(hash(i + 90) * W, H * (0.2 + hash(i + 40) * 0.3), 4, 2.5, C('#ffb0f0'));
  }
  if (env === 'celestial') {
    for (let i = 0; i < 6; i += 1) p.disc(hash(i + 50) * W, H * (0.5 + hash(i + 60) * 0.1), 18, 6, C('#ffffff'));
  }
  return p;
}

// Mid layer: transparent PNG with nearer silhouettes that tile horizontally.
export function midLayer(env, W = 480, H = 240) {
  const e = ENV[env];
  const p = new Pix(W, H);
  const base = H * 0.85;
  const mc = C(e.mid);
  switch (env) {
    case 'village':
      row(p, W, 6, (x, r) => house(p, x, base, 18 + Math.round(r * 10), 14 + Math.round(r * 10), mc, C('#2a1a2a'), C('#f0c060')), 2);
      row(p, W, 5, (x, r) => deadTree(p, x, base, 26 + Math.round(r * 14), mc), 4);
      p.disc(W * 0.5, base - 30, 3, 3, mc);
      p.rect(W * 0.5 - 1, base - 46, 2, 16, mc);
      break;
    case 'forest':
      row(p, W, 14, (x, r) => pineTree(p, x, base + 4, 40 + Math.round(r * 36), mc, C('#0a1408')), 3);
      break;
    case 'frost':
      row(p, W, 10, (x, r) => { p.poly([[x - 6, base], [x, base - 26 - r * 20], [x + 6, base]], mc); }, 5);
      break;
    case 'fortress':
      row(p, W, 3, (x) => castle(p, x - 10, base, 40, 58, mc, C('#ff8a3d')), 6);
      break;
    case 'shadow':
      row(p, W, 6, (x, r) => { p.rect(x - 4, base - 60 - r * 30, 8, 60 + r * 30, mc); }, 8);
      break;
    case 'desert':
      row(p, W, 3, (x, r) => { p.poly([[x - 30, base], [x, base - 50 - r * 16], [x + 30, base]], mc); }, 9);
      break;
    case 'sunken':
      row(p, W, 6, (x, r) => { p.rect(x - 5, base - 40 - r * 20, 10, 40 + r * 20, mc); p.rect(x - 8, base - 40 - r * 20, 16, 3, mc); }, 10);
      for (let i = 0; i < 26; i += 1) p.disc(hash(i * 3 + 1) * W, hash(i * 3 + 2) * H * 0.7, 1.5, 1.5, C('#5af0ff'));
      break;
    case 'mountain':
      row(p, W, 4, (x, r) => { p.poly([[x - 40, base], [x, base - 80 - r * 30], [x + 40, base]], mc); }, 11);
      break;
    case 'nightmare':
      row(p, W, 7, (x, r) => {
        const h = 40 + Math.round(r * 40);
        p.poly([[x - 12, base], [x - 6, base - h], [x + 6, base - h - 8], [x + 12, base]], mc);
        p.disc(x, base - h, 4, 4, C('#ff9af0'));
        p.set(x, base - h, C('#120a18'));
      }, 12);
      break;
    case 'celestial':
      row(p, W, 4, (x, r) => {
        p.disc(x, base - 60 - r * 20, 46 + r * 10, 12, mc);
        p.poly([[x - 26, base - 52 - r * 20], [x + 26, base - 52 - r * 20], [x, base - 10]], C('#e8e0ff'));
      }, 13);
      break;
    default:
      break;
  }
  return p;
}

// Ground: seamless 32x32 tile.
export function groundTile(env) {
  const e = ENV[env];
  const T = 32;
  const p = new Pix(T, T);
  const cols = e.ground.map(C);
  for (let y = 0; y < T; y += 1) for (let x = 0; x < T; x += 1) {
    const r = hash(x * 13 + y * 57 + env.length * 101);
    const idx = r < 0.55 ? 0 : r < 0.8 ? 1 : r < 0.93 ? 2 : 3;
    p.set(x, y, cols[idx]);
  }
  const hi = lighten(cols[0], 0.15);
  const lo = darken(cols[1], 0.25);
  switch (env) {
    case 'village':
    case 'fortress':
      for (let y = 0; y < T; y += 8) { for (let x = 0; x < T; x += 1) p.set(x, y, lo); }
      for (let y = 0; y < T; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < T; x += 16) for (let k = 0; k < 8; k += 1) p.set(x, y + k, lo);
      break;
    case 'forest':
    case 'nightmare':
      for (let x = 0; x < T; x += 4) { const h = 2 + Math.floor(hash(x * 9) * 3); p.rect(x, T - h, 1, h, lighten(cols[0], 0.2)); }
      break;
    case 'frost':
    case 'celestial':
      for (let i = 0; i < 10; i += 1) p.set(hash(i * 3) * T, hash(i * 3 + 1) * T, lighten(cols[0], 0.5));
      break;
    case 'desert':
      for (let i = 0; i < 14; i += 1) p.set(hash(i * 5 + 3) * T, hash(i * 5 + 4) * T, lo);
      break;
    case 'sunken':
      for (let y = 0; y < T; y += 6) for (let x = (y / 6) % 2 ? 0 : 4; x < T; x += 8) p.set(x, y, hi);
      break;
    case 'shadow':
    case 'mountain':
      for (let i = 0; i < 6; i += 1) { const x = hash(i * 7) * T; const y = hash(i * 7 + 1) * T; p.set(x, y, hi); p.set(x + 1, y, lo); }
      break;
    default:
      break;
  }
  // Top edge highlight so the ground reads as a walkable surface.
  for (let x = 0; x < T; x += 1) p.set(x, 0, hi);
  return p;
}

// Title art (640x360, not tiled).
export function titleArt() {
  const W = 640, H = 360;
  const p = farLayer('village', W, H);
  const castleX = 330, base = 300;
  castle(p, castleX - 30, base, 60, 90, C('#15101e'), C('#f0c060'));
  castle(p, castleX + 60, base - 10, 36, 60, C('#15101e'), C('#f0c060'));
  p.rect(0, base, W, H - base, C('#1a1226'));
  const mid = midLayer('village', W, H);
  p.blit(mid, 0, 0);
  return p;
}

export const ENV_IDS = Object.keys(ENV);

// Logo: pixel wordmark GRAVEMARK in a 5x7 font.
const FONT = {
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

export function logo(text = 'GRAVEMARK') {
  const scale = 3;
  const gap = 1;
  let width = 0;
  for (const ch of text) width += (FONT[ch]?.[0].length ?? 5) * scale + gap * scale;
  const p = new Pix(width + 12, 7 * scale + 12);
  let x = 6;
  for (const ch of text) {
    const g = FONT[ch];
    if (!g) continue;
    for (let gy = 0; gy < 7; gy += 1) for (let gx = 0; gx < g[0].length; gx += 1) {
      if (g[gy][gx] !== '1') continue;
      const px = x + gx * scale, py = 6 + gy * scale;
      p.rect(px, py + 2, scale, scale, C('#140c1c'));
      p.rect(px, py, scale, scale, C('#ffd27a'));
      if (gy < 2) p.rect(px, py, scale, 1, C('#fff2c0'));
      if (gy > 4) p.rect(px, py + scale - 1, scale, 1, C('#c8741c'));
    }
    x += g[0].length * scale + gap * scale;
  }
  return p;
}
