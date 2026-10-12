// Tiny pixel canvas used by the asset generator. Colors are packed 0xRRGGBBAA.
import { encodePNG } from './png.mjs';

export function C(hex) {
  let h = hex.replace('#', '');
  if (h.length === 6) h += 'ff';
  return (parseInt(h, 16) >>> 0);
}

export function mix(a, b, t) {
  const ar = (a >>> 24) & 255, ag = (a >>> 16) & 255, ab = (a >>> 8) & 255, aa = a & 255;
  const br = (b >>> 24) & 255, bg = (b >>> 16) & 255, bb = (b >>> 8) & 255, ba = b & 255;
  const f = (x, y) => Math.round(x + (y - x) * t);
  return ((f(ar, br) << 24) | (f(ag, bg) << 16) | (f(ab, bb) << 8) | f(aa, ba)) >>> 0;
}
export const lighten = (c, t = 0.2) => (c === 0 ? 0 : mix(c, 0xffffffff, t));
export const darken = (c, t = 0.2) => (c === 0 ? 0 : mix(c, 0x000000ff, t));
export const withAlpha = (c, a) => ((c & 0xffffff00) | Math.round(a * 255)) >>> 0;

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x];
  }

  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (c == null || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if ((c & 0xff) === 0) return; // fully transparent colors are no-ops
    this.d[y * this.w + x] = c >>> 0;
  }

  // Writes opaque pixels, honoring the destination (no alpha blending beyond on/off).
  rect(x, y, w, h, c) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.set(x + i, y + j, c);
  }

  disc(cx, cy, rx, ry, c) {
    ry = ry ?? rx;
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  ring(cx, cy, rx, ry, c, th = 1) {
    ry = ry ?? rx;
    const x0 = Math.floor(cx - rx - th), x1 = Math.ceil(cx + rx + th);
    const y0 = Math.floor(cy - ry - th), y1 = Math.ceil(cy + ry + th);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        const inner = (rx - th) / rx;
        if (d <= 1 && d >= Math.max(0, inner)) this.set(x, y, c);
      }
    }
  }

  // Thick line: stamps a th x th square along the Bresenham path.
  line(x0, y0, x1, y1, c, th = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((th - 1) / 2);
    for (;;) {
      if (th <= 1) this.set(x0, y0, c);
      else this.rect(x0 - off, y0 - off, th, th, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Filled polygon (even-odd scanline over pixel centers).
  poly(points, c) {
    if (points.length < 3) return;
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of points) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += 1) {
      const sy = y + 0.5;
      const xs = [];
      for (let i = 0; i < points.length; i += 1) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
          xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x += 1) this.set(x, y, c);
      }
    }
  }

  blit(src, dx, dy, flip = false) {
    for (let y = 0; y < src.h; y += 1) {
      for (let x = 0; x < src.w; x += 1) {
        const c = src.d[y * src.w + x];
        if ((c & 0xff) === 0) continue;
        this.set(dx + (flip ? src.w - 1 - x : x), dy + y, c);
      }
    }
  }

  clone() {
    const p = new Pix(this.w, this.h);
    p.d.set(this.d);
    return p;
  }

  flipX() {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y += 1) for (let x = 0; x < this.w; x += 1) p.d[y * this.w + x] = this.d[y * this.w + this.w - 1 - x];
    return p;
  }

  toRGBA() {
    const out = new Uint8Array(this.w * this.h * 4);
    for (let i = 0; i < this.d.length; i += 1) {
      const c = this.d[i];
      out[i * 4] = (c >>> 24) & 255;
      out[i * 4 + 1] = (c >>> 16) & 255;
      out[i * 4 + 2] = (c >>> 8) & 255;
      out[i * 4 + 3] = c & 255;
    }
    return out;
  }

  toPNG() {
    return encodePNG(this.w, this.h, this.toRGBA());
  }
}

const NEIGH8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// Adds a 1px outline around every opaque pixel (8-neighborhood) and applies
// a light-from-top-left shading pass. Returns a new Pix.
export function bake(src, { outline = '#140c1c', shade = true, shadeAmt = 0.18 } = {}) {
  const oc = C(outline);
  const out = new Pix(src.w, src.h);
  out.d.set(src.d);
  const isBody = (x, y) => {
    const c = src.get(x, y);
    return (c & 0xff) !== 0 && c !== oc;
  };
  // Outline pass.
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      if (isBody(x, y)) continue;
      if ((src.get(x, y) & 0xff) !== 0) continue;
      for (const [dx, dy] of NEIGH8) {
        if (isBody(x + dx, y + dy)) { out.d[y * src.w + x] = oc; break; }
      }
    }
  }
  if (!shade) return out;
  // Shading pass: highlight where up/left are open, darken where down/right are open.
  const empty = (x, y) => {
    const c = out.get(x, y);
    return (c & 0xff) === 0 || c === oc;
  };
  const res = out.clone();
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      const c = out.get(x, y);
      if ((c & 0xff) === 0 || c === oc) continue;
      const hi = empty(x, y - 1) || empty(x - 1, y);
      const lo = empty(x, y + 1) || empty(x + 1, y);
      // Color boundaries between different body parts get a darker seam.
      const seam = (() => {
        for (const [dx, dy] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {
          const n = out.get(x + dx, y + dy);
          if ((n & 0xff) !== 0 && n !== oc && n !== c) return true;
        }
        return false;
      })();
      if (hi && !lo) res.d[y * src.w + x] = lighten(c, shadeAmt);
      else if (lo && !hi) res.d[y * src.w + x] = darken(c, shadeAmt + 0.08);
      else if (seam && (x + y) % 2 === 0) res.d[y * src.w + x] = darken(c, 0.14);
    }
  }
  return res;
}

// Packs rows of frames into a single sheet. rows: Array<Array<Pix>>.
export function packSheet(fw, fh, rows, cols) {
  const sheet = new Pix(fw * cols, fh * rows.length);
  rows.forEach((row, r) => row.forEach((frame, c) => {
    if (frame) sheet.blit(frame, c * fw, r * fh);
  }));
  return sheet;
}
