// Procedural pixel-art rigs. Each rig draws one animation frame from a spec
// (colors, proportions, equipment) and a pose (joint angles and effects).
// All rigs draw facing right; the game flips sprites for left-facing movement.
import { Pix, C, lighten, darken, bake, mix } from './pix.mjs';

export const D2R = Math.PI / 180;
const sn = (d) => Math.sin(d * D2R);
const cs = (d) => Math.cos(d * D2R);
// Limb convention: angle 0 = straight down, +90 = forward (+x), 180 = up.
const limbDir = (t, len) => [sn(t) * len, cs(t) * len];
// Weapon convention: angle 0 = forward (+x), 90 = up, -90 = down.
export const limbAngleOf = (w) => Math.atan2(cs(w), -sn(w)) / D2R;
export const weaponAngleOf = (t) => Math.atan2(-cs(t), sn(t)) / D2R;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const R = (v) => Math.round(v);

// Shared color helpers ---------------------------------------------------------
const col = (hex) => C(hex);
function palette(spec) {
  const c = {};
  for (const [k, v] of Object.entries(spec.colors || {})) c[k] = typeof v === 'string' ? col(v) : v;
  c.skinD = c.skinD ?? darken(c.skin ?? col('#e8b48a'), 0.2);
  c.armorD = c.armorD ?? darken(c.armor ?? col('#8895a6'), 0.3);
  c.clothD = c.clothD ?? darken(c.cloth ?? col('#5a4a7a'), 0.3);
  c.bootD = c.bootD ?? darken(c.boot ?? col('#3a2a20'), 0.3);
  c.metal = c.metal ?? col('#c9d3dc');
  c.metalD = c.metalD ?? darken(c.metal, 0.3);
  c.grip = c.grip ?? col('#5b3a22');
  c.glow = c.glow ?? col('#ffe27a');
  c.eye = c.eye ?? col('#120a18');
  return c;
}

// Transform helper: rotates local points around a pivot, then translates.
function makeXf(pivot, rot, bob) {
  const a = (rot || 0) * D2R;
  const ca = Math.cos(a), sa = Math.sin(a);
  return (x, y) => {
    const dx = x - pivot[0], dy = y - pivot[1];
    return [pivot[0] + dx * ca - dy * sa, pivot[1] + dx * sa + dy * ca + (bob || 0)];
  };
}

// Draws a limb segment with round joints.
function seg(p, a, b, th, c) {
  p.line(a[0], a[1], b[0], b[1], c, th);
  if (th >= 2) p.disc(b[0], b[1], th / 2 - 0.1, th / 2 - 0.1, c);
}

// Keeps only pixels in bbox whose color equals `from` and applies `fn` (pattern recolor).
function recolorPattern(p, x0, y0, x1, y1, from, to, test) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y += 1) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x += 1) {
      if (p.get(x, y) === from && test(x, y)) p.set(x, y, to);
    }
  }
}

// ---------------------------------------------------------------------------
// HUMANOID
// ---------------------------------------------------------------------------
export function humanoidDims(spec) {
  const s = spec.s ?? 1;
  const ch = spec.chunky ? 1.25 : 1;
  return {
    thigh: Math.max(3, R(6.5 * s)),
    shin: Math.max(3, R(6 * s)),
    torso: Math.max(4, R(10 * s)),
    tw: Math.max(4, R(8 * s * ch)),
    headR: Math.max(3, R(4.6 * s * (spec.headScale ?? 1))),
    upper: Math.max(3, R(5.5 * s)),
    fore: Math.max(3, R(5 * s)),
    th: Math.max(2, R(2.4 * s * ch)),
  };
}

export function humanoidHeight(spec) {
  const d = humanoidDims(spec);
  return d.thigh + d.shin + d.torso + d.headR * 2;
}

function drawWeapon(p, kind, H, w, s, c, extra = {}) {
  const dir = [Math.cos(w * D2R), -Math.sin(w * D2R)];
  const perp = [-dir[1], dir[0]];
  const at = (len) => [H[0] + dir[0] * len, H[1] + dir[1] * len];
  const L = (base) => Math.max(4, R(base * s));
  switch (kind) {
    case 'sword':
    case 'greatsword':
    case 'steel': {
      const big = kind === 'greatsword';
      const len = L(big ? 19 : 13);
      const th = big ? 3 : 2;
      const tip = at(len);
      const back = [H[0] - dir[0] * 3, H[1] - dir[1] * 3];
      p.line(back[0], back[1], H[0], H[1], c.grip, 2);
      const g = [H[0] + dir[0] * 1, H[1] + dir[1] * 1];
      p.line(g[0] + perp[0] * (big ? 4 : 3), g[1] + perp[1] * (big ? 4 : 3), g[0] - perp[0] * (big ? 4 : 3), g[1] - perp[1] * (big ? 4 : 3), c.guard ?? c.metalD, 1);
      p.line(H[0] + dir[0] * 2, H[1] + dir[1] * 2, tip[0], tip[1], c.blade ?? c.metal, th);
      p.set(tip[0], tip[1], c.bladeHi ?? lighten(c.metal, 0.5));
      break;
    }
    case 'dagger': {
      const tip = at(L(8));
      p.line(H[0] - dir[0] * 2, H[1] - dir[1] * 2, H[0], H[1], c.grip, 1);
      p.line(H[0] + dir[0], H[1] + dir[1], tip[0], tip[1], c.blade ?? c.metal, 2);
      break;
    }
    case 'scimitar': {
      const len = L(13);
      const a = at(len * 0.5);
      const t = at(len);
      p.line(H[0], H[1], a[0], a[1], c.blade ?? c.metal, 2);
      p.line(a[0], a[1], t[0] + perp[0] * 2, t[1] + perp[1] * 2, c.blade ?? c.metal, 2);
      break;
    }
    case 'axe': {
      const len = L(15);
      const tip = at(len);
      p.line(H[0] - dir[0] * 2, H[1] - dir[1] * 2, tip[0], tip[1], c.grip, 2);
      const bl = [tip[0] + perp[0] * 4, tip[1] + perp[1] * 4];
      const br = [tip[0] - perp[0] * 4, tip[1] - perp[1] * 4];
      const bt = [tip[0] + dir[0] * 3, tip[1] + dir[1] * 3];
      p.poly([tip, bl, bt, br], c.blade ?? c.metal);
      p.line(tip[0], tip[1], bt[0], bt[1], c.bladeHi ?? lighten(c.metal, 0.5), 1);
      break;
    }
    case 'double_axe': {
      drawWeapon(p, 'axe', H, w, s * 0.85, c);
      const perpA = [-perp[0], -perp[1]];
      const tip = [H[0] + perpA[0] * 9 * s, H[1] + perpA[1] * 9 * s];
      p.line(H[0], H[1], tip[0], tip[1], c.grip, 2);
      break;
    }
    case 'mace':
    case 'hammer': {
      const len = L(12);
      const tip = at(len);
      p.line(H[0] - dir[0] * 2, H[1] - dir[1] * 2, tip[0], tip[1], c.grip, 2);
      p.disc(tip[0], tip[1], kind === 'hammer' ? 3 * s + 1 : 2.5 * s + 0.5, kind === 'hammer' ? 2 * s + 1 : 2.5 * s + 0.5, c.metal);
      p.set(tip[0] - 1, tip[1] - 1, lighten(c.metal, 0.6));
      break;
    }
    case 'staff': {
      const len = L(20);
      const tip = at(len);
      p.line(H[0] - dir[0] * 4, H[1] - dir[1] * 4, tip[0], tip[1], c.grip, 2);
      const orbR = Math.max(2, R(2.4 * s));
      p.disc(tip[0], tip[1], orbR + 1, orbR + 1, c.glowDark ?? darken(c.glow, 0.4));
      p.disc(tip[0], tip[1], orbR, orbR, c.glow);
      p.set(tip[0] - 1, tip[1] - 1, lighten(c.glow, 0.6));
      break;
    }
    case 'spear':
    case 'lance':
    case 'glaive': {
      const len = L(kind === 'lance' ? 26 : 24);
      const tip = at(len);
      p.line(H[0] - dir[0] * 4, H[1] - dir[1] * 4, tip[0] - dir[0] * 3, tip[1] - dir[1] * 3, c.grip, 2);
      const bl = [tip[0] - dir[0] * 4 + perp[0] * 2.5, tip[1] - dir[1] * 4 + perp[1] * 2.5];
      const br = [tip[0] - dir[0] * 4 - perp[0] * 2.5, tip[1] - dir[1] * 4 - perp[1] * 2.5];
      p.poly([tip, bl, br], c.blade ?? c.metal);
      if (kind === 'glaive') p.poly([[tip[0] - dir[0] * 2, tip[1] - dir[1] * 2], [tip[0] - dir[0] * 6 + perp[0] * 4, tip[1] - dir[1] * 6 + perp[1] * 4], [tip[0] - dir[0] * 6, tip[1] - dir[1] * 6]], c.blade ?? c.metal);
      break;
    }
    case 'trident': {
      const len = L(22);
      const tip = at(len);
      p.line(H[0] - dir[0] * 4, H[1] - dir[1] * 4, tip[0] - dir[0] * 3, tip[1] - dir[1] * 3, c.grip, 2);
      for (const k of [-3, 0, 3]) {
        const t = [tip[0] + perp[0] * k, tip[1] + perp[1] * k];
        p.line(t[0] - dir[0] * 4, t[1] - dir[1] * 4, t[0] + dir[0] * 2, t[1] + dir[1] * 2, c.blade ?? c.metal, 1);
      }
      break;
    }
    case 'bow': {
      const len = L(9);
      const bulge = len * 0.9;
      const a = [H[0] + perp[0] * len, H[1] + perp[1] * len];
      const b = [H[0] - perp[0] * len, H[1] - perp[1] * len];
      const m = [H[0] + dir[0] * bulge, H[1] + dir[1] * bulge];
      let prev = a;
      for (let t = 0.1; t <= 1.001; t += 0.1) {
        const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * m[0] + t * t * b[0];
        const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * m[1] + t * t * b[1];
        p.line(prev[0], prev[1], x, y, c.grip, 1);
        prev = [x, y];
      }
      const pulled = [H[0] - dir[0] * 3, H[1] - dir[1] * 3];
      p.line(a[0], a[1], pulled[0], pulled[1], c.string ?? lighten(c.metal, 0.4), 1);
      p.line(pulled[0], pulled[1], b[0], b[1], c.string ?? lighten(c.metal, 0.4), 1);
      break;
    }
    case 'orb': {
      const r = Math.max(2, R(3 * s));
      p.disc(H[0], H[1], r + 1, r + 1, c.glowDark ?? darken(c.glow, 0.4));
      p.disc(H[0], H[1], r, r, c.glow);
      p.set(H[0] - 1, H[1] - 1, lighten(c.glow, 0.6));
      break;
    }
    case 'claws': {
      for (const k of [-2, 0, 2]) {
        const t = [H[0] + perp[0] * k, H[1] + perp[1] * k];
        p.line(t[0], t[1], t[0] + dir[0] * 4 + perp[0] * 1, t[1] + dir[1] * 4 + perp[1] * 1, c.claw ?? col('#f2ead8'), 1);
      }
      break;
    }
    case 'bone': {
      const len = L(13);
      const tip = at(len);
      p.line(H[0], H[1], tip[0], tip[1], c.bone ?? col('#ece4cc'), 2);
      p.disc(tip[0], tip[1], 2, 2, c.bone ?? col('#ece4cc'));
      break;
    }
    case 'ice_spear': {
      drawWeapon(p, 'spear', H, w, s, { ...c, blade: c.ice ?? col('#bfeaff'), grip: c.grip });
      break;
    }
    case 'rod': {
      const len = L(17);
      const tip = at(len);
      p.line(H[0], H[1], tip[0], tip[1], c.grip, 2);
      p.disc(tip[0], tip[1], 2, 2, c.glow);
      break;
    }
    case 'kite_shield':
    case 'shield': {
      const sc = (s * 1.0);
      const cx = H[0] + dir[0] * 1, cy = H[1] + dir[1] * 1;
      const top = [cx - perp[0] * 5 * sc, cy - perp[1] * 5 * sc];
      const bot = [cx + perp[0] * 5 * sc, cy + perp[1] * 5 * sc];
      const pt = [cx + dir[0] * 4 * sc, cy + dir[1] * 4 * sc];
      const fr = [cx - dir[0] * 4 * sc, cy - dir[1] * 4 * sc];
      p.poly([top, bot, pt, fr], c.shield ?? col('#3f6fb0'));
      p.line(cx, cy - 4 * sc, cx, cy + 4 * sc, c.shieldTrim ?? col('#e7d27a'), 1);
      break;
    }
    case 'tower_shield': {
      const cx = H[0], cy = H[1];
      p.rect(cx - 4, cy - 9, 6, 16, c.shield ?? col('#8c6a3a'));
      p.rect(cx - 4, cy - 9, 6, 1, c.shieldTrim ?? col('#e7d27a'));
      p.rect(cx - 1, cy - 8, 1, 14, c.shieldTrim ?? col('#e7d27a'));
      break;
    }
    case 'orb_off':
      break;
    default:
      break;
  }
  void extra;
}

function drawFace(p, style, H, r, c, pose) {
  const [hx, hy] = H;
  const skin = c.skin;
  const hair = c.hair ?? col('#3a2a20');
  const helm = c.armor;
  const helmD = c.armorD;
  const trim = c.trim ?? c.glow;
  // Back layer (hair/cape that stays behind the head).
  if (style === 'long') p.disc(hx - r * 0.7, hy + r * 0.5, r * 0.8, r * 1.4, hair);
  if (style === 'mane') {
    p.disc(hx - r * 0.5, hy + r * 0.1, r * 1.5, r * 1.2, hair);
    p.line(hx - r * 1.2, hy - r * 0.4, hx - r * 2.5, hy - r * 1.2, hair, 2);
  }
  if (style === 'ponytail') p.line(hx - r * 0.8, hy - r * 0.4, hx - r * 2.4, hy + r * 0.6, hair, 2);
  if (style === 'horns' || style === 'demon') {
    const hc = c.horn ?? col('#d8cdb0');
    p.line(hx - r * 0.5, hy - r * 0.7, hx - r * 1.3, hy - r * 2.3, hc, 2);
    p.line(hx + r * 0.1, hy - r * 0.8, hx + r * 0.5, hy - r * 2.4, hc, 2);
  }
  if (style === 'bandana') p.line(hx - r * 0.9, hy - r * 0.6, hx - r * 2.2, hy - r * 0.2, c.trim ?? col('#b0302a'), 2);
  if (style === 'fin') {
    p.poly([[hx - r * 0.8, hy - r * 0.6], [hx - r * 2.2, hy - r * 2.2], [hx - r * 1.3, hy + r * 0.2]], c.fin ?? col('#2a8fa8'));
  }
  if (style === 'hood') p.disc(hx - r * 0.4, hy + r * 0.2, r * 1.4, r * 1.45, c.cloth ?? col('#4b2d6b'));
  if (style === 'cowl') {
    p.poly([[hx - r * 1.5, hy + r * 1.1], [hx + r * 1.2, hy + r * 1.1], [hx - r * 0.2, hy - r * 2.6]], c.cloth ?? col('#4b2d6b'));
  }
  if (style === 'hat_wide') {
    p.poly([[hx - r * 1.4, hy - r * 0.9], [hx + r * 0.9, hy - r * 0.9], [hx - r * 0.3, hy - r * 3.5]], c.hat ?? c.cloth ?? col('#3a2060'));
  }
  if (style === 'halo') p.ring(hx, hy - r * 2.3, r * 1.1, r * 0.45, c.glow, 1);
  if (style === 'skull' || style === 'bone_crown' || style === 'bone') {
    // skull face drawn below
  }
  // Face.
  let faceR = r;
  let faceCol = skin;
  if (style === 'skull' || style === 'bone_crown' || style === 'bone') faceCol = c.bone ?? col('#ece4cc');
  if (style === 'helm' || style === 'dragon_helm' || style === 'sentinel') {
    p.disc(hx, hy, r + 1, r + 0.8, helm);
    p.rect(hx - r * 0.1, hy - r * 1.2, 1, r * 2.2, helmD);
    p.rect(hx + 0.5, hy - 1, r + 0.5, 1, helmD);
    if (style === 'dragon_helm') {
      const hc = c.horn ?? col('#d8cdb0');
      p.line(hx - r * 0.9, hy - r * 0.6, hx - r * 2.0, hy - r * 2.2, hc, 2);
    }
    if (style === 'sentinel') p.ring(hx, hy - r * 2.2, r * 1.0, r * 0.4, c.glow, 1);
    if (style !== 'helm') p.set(hx + r * 0.2, hy - r * 0.3, c.glow);
    if (pose.eyes === 'glow') p.set(hx + r * 0.5, hy - 0.5, c.glow);
    return;
  }
  if (style === 'hood' || style === 'cowl' || style === 'shadow_hood') {
    faceR = r * 0.75;
    p.disc(hx + r * 0.35, hy + r * 0.3, faceR, faceR, faceCol);
    if (style === 'shadow_hood') {
      p.set(hx + r * 0.4, hy - 0.5, c.glow);
      p.set(hx + r * 0.8, hy - 0.5, c.glow);
    }
  } else {
    p.disc(hx, hy, faceR, faceR, faceCol);
  }
  // Front hair / hats.
  switch (style) {
    case 'short':
    case 'long':
    case 'mane':
    case 'ponytail':
    case 'horns':
    case 'demon':
    case 'bandana':
      p.disc(hx - r * 0.2, hy - r * 0.35, r + 0.4, r * 0.8, hair);
      p.rect(hx + r * 0.3, hy - r * 0.2, r * 0.8, 1, hair);
      if (style === 'bandana') {
        p.rect(hx - r, hy - r * 0.4, r * 2 + 1, 1, c.trim ?? col('#b0302a'));
      }
      break;
    case 'patchy':
      p.set(hx - 2, hy - r + 1, hair);
      p.set(hx, hy - r, hair);
      p.set(hx - 3, hy - r + 2, hair);
      break;
    case 'hat':
      p.rect(hx - r * 1.4, hy - r * 0.9, r * 2.8, 2, c.hat ?? col('#4b3a2a'));
      p.disc(hx - r * 0.2, hy - r * 0.9, r * 0.9, r * 0.8, c.hat ?? col('#4b3a2a'));
      break;
    case 'hat_wide':
      p.rect(hx - r * 1.6, hy - r * 0.9, r * 3.2, 2, c.hat ?? c.cloth ?? col('#3a2060'));
      p.set(hx + r * 0.4, hy - r * 1.8, c.glow);
      break;
    case 'crown':
    case 'bone_crown':
    case 'ice_crown':
      p.rect(hx - r * 0.9, hy - r * 1.0, r * 1.8, 2, c.crown ?? (style === 'ice_crown' ? col('#bfeaff') : col('#e8c24a')));
      p.set(hx - r * 0.8, hy - r * 1.8, c.crown ?? col('#e8c24a'));
      p.set(hx, hy - r * 2.0, c.crown ?? col('#e8c24a'));
      p.set(hx + r * 0.7, hy - r * 1.8, c.crown ?? col('#e8c24a'));
      break;
    case 'leaves':
      p.disc(hx - r * 0.2, hy - r * 0.9, r + 1, r * 0.9, c.leaf ?? col('#3e9a4a'));
      p.set(hx - r, hy - r * 1.8, c.leafL ?? col('#7fdc78'));
      p.set(hx + r * 0.2, hy - r * 2.2, c.leafL ?? col('#7fdc78'));
      break;
    case 'patchwork':
      p.disc(hx - r * 0.2, hy - r * 0.5, r * 0.9, r * 0.6, hair);
      break;
    case 'helmet_plain':
      break;
    default:
      break;
  }
  // Eyes.
  const ex = hx + r * 0.45, ey = hy - r * 0.05;
  const eye = c.eye;
  if (pose.eyes === 'x') {
    p.set(ex - 1, ey - 1, eye); p.set(ex + 1, ey + 1, eye); p.set(ex + 1, ey - 1, eye); p.set(ex - 1, ey + 1, eye);
  } else if (pose.eyes === 'closed') {
    p.rect(ex - 1, ey, 2, 1, eye);
  } else if (pose.eyes === 'glow') {
    p.set(ex, ey - 0.5, c.glow); p.set(ex + 1, ey - 0.5, c.glow);
    p.set(ex, ey + 0.5, c.glowDark ?? darken(c.glow, 0.3));
  } else if (pose.eyes === 'angry') {
    p.set(ex, ey, eye); p.set(ex + 1, ey - 1, eye);
  } else {
    p.set(ex, ey, eye);
    if (style === 'skull' || style === 'bone_crown') p.set(ex, ey, eye);
  }
  if (style === 'skull' || style === 'bone_crown') p.rect(hx + r * 0.2, hy + r * 0.6, r * 0.8, 1, darken(faceCol, 0.35));
  if (style === 'fin') p.line(hx - r * 0.1, hy + r * 0.3, hx - r * 0.4, hy + r * 0.9, darken(skin, 0.2), 1);
  if (style === 'shadow_hood' || style === 'hood' || style === 'cowl') {
    // Faint glowing eyes already drawn.
  }
}

function torsoPaint(p, spec, c, T) {
  const { top, tw, W } = T;
  const tr = W;
  const mainCol = c.armor;
  const style = spec.torso || 'plate';
  const ptsTorso = [tr(top[0] - tw * 0.45, top[1]), tr(top[0] + tw * 0.45, top[1]), tr(tw * 0.5, 0), tr(-tw * 0.5, 0)];
  const fill = (cc) => p.poly(ptsTorso, cc);
  const midX = top[0];
  switch (style) {
    case 'plate': {
      fill(mainCol);
      p.line(tr(midX, top[1] + 1)[0], tr(midX, top[1] + 1)[1], tr(0, -1)[0], tr(0, -1)[1], lighten(mainCol, 0.35), 1);
      const belt = [tr(-tw * 0.5, -2), tr(tw * 0.5, -2)];
      p.line(belt[0][0], belt[0][1], belt[1][0], belt[1][1], c.trim ?? c.glow, 1);
      const pl = tr(top[0] - tw * 0.4, top[1] + 1);
      p.disc(pl[0], pl[1], tw * 0.28, tw * 0.25, lighten(mainCol, 0.2));
      break;
    }
    case 'tabard': {
      fill(mainCol);
      const a = tr(top[0] - tw * 0.1, top[1]);
      const b = tr(0, 0);
      p.rect(Math.min(a[0], b[0]) - 1, a[1], 3, Math.abs(b[1] - a[1]), c.cloth ?? col('#a8323a'));
      break;
    }
    case 'robe': {
      fill(c.cloth);
      const bottom = [tr(-tw * 0.5 - 1, 0), tr(tw * 0.5 + 1, 0), tr(tw * 0.8, spec.robeLen ?? 14), tr(-tw * 0.9, spec.robeLen ?? 14)];
      p.poly(bottom, c.cloth);
      p.poly([tr(-tw * 0.5, 0), tr(-tw * 0.1, 0), tr(-tw * 0.7, spec.robeLen ?? 14)], c.clothD);
      const belt = [tr(-tw * 0.5, -1), tr(tw * 0.5, -1)];
      p.line(belt[0][0], belt[0][1], belt[1][0], belt[1][1], c.trim ?? c.glow, 1);
      break;
    }
    case 'leather': {
      fill(c.leather ?? col('#7a5a3a'));
      const s1 = tr(top[0] - tw * 0.35, top[1] + 1), s2 = tr(tw * 0.25, -1);
      p.line(s1[0], s1[1], s2[0], s2[1], c.leatherD ?? col('#4a3420'), 1);
      const belt = [tr(-tw * 0.5, -2), tr(tw * 0.5, -2)];
      p.line(belt[0][0], belt[0][1], belt[1][0], belt[1][1], c.leatherD ?? col('#4a3420'), 1);
      break;
    }
    case 'bare': {
      fill(c.skin);
      break;
    }
    case 'tunic': {
      fill(c.cloth);
      const belt = [tr(-tw * 0.5, -2), tr(tw * 0.5, -2)];
      p.line(belt[0][0], belt[0][1], belt[1][0], belt[1][1], c.leather ?? col('#6b4a2a'), 1);
      break;
    }
    case 'ribs': {
      // Hollow ribcage: spine plus curved ribs.
      const spine0 = tr(top[0] * 0.2, top[1]);
      const spine1 = tr(0, 0);
      p.line(spine0[0], spine0[1], spine1[0], spine1[1], c.bone, 1);
      for (let k = 0; k < 4; k += 1) {
        const y = top[1] + 2 + k * (-top[1] - 3) / 4;
        const a = tr(-tw * 0.45 + k * 0.4, y), b = tr(tw * 0.4, y + 1);
        p.line(a[0], a[1], b[0], b[1], c.bone, 1);
      }
      const pel = tr(0, -2);
      p.disc(pel[0], pel[1], tw * 0.3, 1.5, c.bone);
      break;
    }
    case 'mail': {
      fill(mainCol);
      const bb = ptsTorso.reduce((a, q) => ({ x0: Math.min(a.x0, q[0]), y0: Math.min(a.y0, q[1]), x1: Math.max(a.x1, q[0]), y1: Math.max(a.y1, q[1]) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
      recolorPattern(p, bb.x0, bb.y0, bb.x1, bb.y1, mainCol, c.armorD, (x, y) => (x + y) % 3 === 0);
      break;
    }
    case 'frost': {
      fill(c.armor);
      const sp = [tr(top[0] - tw * 0.6, top[1] - 1), tr(top[0] - tw * 0.4, top[1] - 4), tr(top[0] - tw * 0.1, top[1])];
      p.poly(sp, c.ice ?? col('#bfeaff'));
      const sp2 = [tr(top[0] + tw * 0.6, top[1] - 1), tr(top[0] + tw * 0.5, top[1] - 4), tr(top[0] + tw * 0.2, top[1])];
      p.poly(sp2, c.ice ?? col('#bfeaff'));
      break;
    }
    case 'shadow': {
      fill(c.armor);
      const a = tr(-tw * 0.1, top[1] + 2), b = tr(tw * 0.2, -3);
      p.line(a[0], a[1], b[0], b[1], c.glow, 1);
      break;
    }
    case 'scale': {
      fill(c.armor);
      const bb = ptsTorso.reduce((a, q) => ({ x0: Math.min(a.x0, q[0]), y0: Math.min(a.y0, q[1]), x1: Math.max(a.x1, q[0]), y1: Math.max(a.y1, q[1]) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
      recolorPattern(p, bb.x0, bb.y0, bb.x1, bb.y1, mainCol, lighten(mainCol, 0.2), (x, y) => (x + 2 * y) % 4 === 0);
      break;
    }
    case 'bulk': {
      fill(c.armor);
      const sh = tr(-tw * 0.2, -tw * 0.2);
      p.poly([sh, tr(tw * 0.3, -6), tr(tw * 0.1, -2)], c.glow);
      break;
    }
    case 'dark': {
      fill(c.armor);
      const belt = [tr(-tw * 0.5, -2), tr(tw * 0.5, -2)];
      p.line(belt[0][0], belt[0][1], belt[1][0], belt[1][1], c.glow, 1);
      break;
    }
    default:
      fill(mainCol);
  }
  return ptsTorso;
}

// Draws the full humanoid body. Returns anchor points for overlays.
export function drawHumanoid(p, spec, pose, anchor) {
  const c = palette(spec);
  const d = humanoidDims(spec);
  const cx = anchor.cx;
  const hipY = anchor.baseY - (d.thigh + d.shin);
  const xf = makeXf([cx, hipY], pose.rot, pose.bob);
  const hunch = (spec.hunch || 0) + (pose.hunch || 0);
  const lean = pose.lean || 0;
  const top = [sn(hunch) * d.torso + lean, -cs(hunch) * d.torso];
  const elbow = pose.elbow ?? 12;
  let af = pose.af ?? [20, elbow];
  let ab = pose.ab ?? [-15, 12];
  if (pose.aim != null) af = [limbAngleOf(pose.aim) - elbow, elbow];
  if (pose.aimB != null) ab = [limbAngleOf(pose.aimB) - 12, 12];
  const stance = spec.stance ?? 3;
  const lf = pose.lf ?? [stance, 0];
  const lb = pose.lb ?? [-stance, 0];
  const shF = add(top, [1, 1]);
  const shB = add(top, [-1, 1]);
  const eF = add(shF, limbDir(af[0], d.upper));
  const hF = add(eF, limbDir(af[0] + af[1], d.fore));
  const eB = add(shB, limbDir(ab[0], d.upper));
  const hB = add(eB, limbDir(ab[0] + ab[1], d.fore));
  const hipF = [1, 0], hipB = [-1, 0];
  const kF = add(hipF, limbDir(lf[0], d.thigh));
  const fF = add(kF, limbDir(lf[0] + lf[1], d.shin));
  const kB = add(hipB, limbDir(lb[0], d.thigh));
  const fB = add(kB, limbDir(lb[0] + lb[1], d.shin));
  const P = (v) => xf(cx + v[0], hipY + v[1]);
  const pl = (v) => P(v);
  const legCol = c.cloth;
  const legD = c.clothD;
  const th = d.th;
  const legStyle = spec.legs || 'boots';
  const legColor = legStyle === 'bare' ? c.skin : legStyle === 'shadow' ? c.armor : legCol;
  const legColorD = legStyle === 'bare' ? c.skinD : legStyle === 'shadow' ? c.armorD : legD;
  const shinCol = legStyle === 'greaves' ? c.armor : legStyle === 'bare' ? c.skin : legColor;
  const footCol = legStyle === 'bare' ? c.skinD : c.boot ?? col('#3a2a20');
  const bootD = c.bootD;

  const drawLeg = (hip, knee, foot, cLeg, cShin, cBoot) => {
    seg(p, pl(hip), pl(knee), th + 0, cLeg);
    seg(p, pl(knee), pl(foot), th, cShin);
    if (legStyle !== 'robe') {
      const f = pl(foot);
      p.rect(f[0] - 1, f[1] - 1, 3, 2, cBoot);
    }
  };
  // Hooks that must sit behind the body (wings, long capes).
  if (spec.behind) spec.behind(p, { c, pl, top, d, pose, cx, hipY });
  // Far (back) arm.
  const sleeveB = c.armorD;
  const armTh = Math.max(2, th - 0);
  seg(p, pl(shB), pl(eB), armTh, spec.sleeveDark ? spec.sleeveDark : (spec.armsStyle === 'bare' ? c.skinD : sleeveB));
  seg(p, pl(eB), pl(hB), Math.max(2, armTh - 1), spec.armsStyle === 'bare' ? c.skinD : darken(sleeveB, 0.1));
  p.disc(pl(hB)[0], pl(hB)[1], 1.3, 1.3, c.skinD);
  // Far (back) leg.
  drawLeg(hipB, kB, fB, legColorD, legStyle === 'greaves' ? darken(c.armorD, 0) : legColorD, bootD);
  // Cape / tail.
  if (spec.cape) {
    const sway = pose.capeSwing ?? 0;
    const cape = spec.cape === true ? c.cape ?? c.cloth : c.cape ?? c.cloth;
    const capeD = darken(cape, 0.25);
    const cpts = [
      pl(add(top, [-tw(d) * 0.5, 1])),
      pl(add(top, [-tw(d) * 0.1, 0])),
      pl([-d.tw * 0.9 - 3 - sway, 2 + d.torso * 0.3]),
      pl([-d.tw * 0.9 - 6 - sway * 1.4, d.torso + d.thigh * 0.7 + (pose.capeLen ?? 0)]),
      pl([-2, d.torso + d.thigh * 0.6]),
    ];
    p.poly(cpts, capeD);
    p.poly([pl(add(top, [-tw(d) * 0.5, 1])), pl(add(top, [-tw(d) * 0.2, 0])), pl([-d.tw * 0.5, d.torso * 0.5])], cape);
  }
  // Torso.
  const T = { top, tw: d.tw, W: (x, y) => pl([x, y]) };
  const torsoPts = torsoPaint(p, spec, c, T);
  // Neck.
  seg(p, pl(top), pl([top[0], top[1] - 1]), 2, c.skin);

  // Hips/legs front (drawn on torso edge).
  drawLeg(hipF, kF, fF, legColor, shinCol, footCol);
  // Armor skirt over hips for robe/plate.
  if (spec.torso === 'plate') {
    const hipL = pl([-d.tw * 0.5, 0]);
    p.rect(hipL[0], hipL[1] - 1, d.tw, 2, c.armorD);
  }
  // Front arm.
  const sleeveF = spec.armsStyle === 'bare' ? c.skin : c.armor;
  const sleeveFD = spec.armsStyle === 'bare' ? c.skinD : c.armor;
  const pauld = spec.torso === 'plate' || spec.torso === 'frost' || spec.torso === 'dark';
  if (pauld) p.disc(pl(shF)[0], pl(shF)[1], 2, 2, lighten(c.armor, 0.15));
  seg(p, pl(shF), pl(eF), armTh, sleeveF);
  seg(p, pl(eF), pl(hF), Math.max(2, armTh - 1), spec.armsStyle === 'bare' ? c.skin : darken(sleeveFD, 0.05));
  p.disc(pl(hF)[0], pl(hF)[1], 1.5, 1.5, c.skin);

  // Head.
  const headOff = pose.head || [0, 0];
  const H = add(top, [0, -d.headR + 1]);
  const Hp = pl([H[0] + headOff[0], H[1] + headOff[1]]);
  const headLocal = [H[0] + headOff[0], H[1] + headOff[1]];
  void headLocal;
  const hr = d.headR;
  const pose2 = pose;
  // Rear layers for hair/hats are inside drawFace via style; body-facing side.
  drawFace(p, spec.head || 'short', Hp, hr, { ...c, skin: c.skin }, pose2);
  // Weapons.
  const handF = pl(hF);
  const handB = pl(hB);
  const aimW = pose.aim != null ? pose.aim : weaponAngleOf(af[0] + af[1]);
  const aimBW = pose.aimB != null ? pose.aimB : weaponAngleOf(ab[0] + ab[1]);
  const rot = (pose.rot || 0);
  const wAngle = (w) => w + rot;
  const wc = { ...c, grip: c.grip, blade: c.blade ?? c.metal, guard: c.guard ?? c.metalD, shield: c.shield, shieldTrim: c.shieldTrim };
  if (spec.weaponBack && pose.backWeapon !== false) {
    drawWeapon(p, spec.weaponBack, handB, wAngle(aimBW), spec.s ?? 1, wc);
  }
  if (spec.offhand === 'shield' || spec.offhand === 'kite_shield') {
    drawWeapon(p, 'shield', handB, wAngle(aimBW), spec.s ?? 1, wc);
  } else if (spec.offhand === 'tower_shield') {
    drawWeapon(p, 'tower_shield', pl([-d.tw * 0.5 - 2, 2]), 0, spec.s ?? 1, wc);
  } else if (spec.offhand === 'orb') {
    p.disc(handB[0], handB[1], 3, 3, c.glowDark ?? darken(c.glow, 0.4));
    p.disc(handB[0], handB[1], 2, 2, c.glow);
  }
  if (spec.weapon && pose.noWeapon !== true) {
    drawWeapon(p, spec.weapon, handF, wAngle(aimW), spec.s ?? 1, wc);
  }
  if (spec.extra) spec.extra(p, { c, d, pl, top, Hp, hF: handF, hB: handB, torsoPts, xf, pose, cx, hipY }, pose);
  return {
    head: Hp,
    chest: pl(top),
    hip: pl([0, 0]),
    hand: handF,
    handB,
    headR: hr,
    feet: [pl(fF), pl(fB)],
    torsoPts,
    d,
  };
}

function tw(d) { return d.tw; }

// ---------------------------------------------------------------------------
// QUADRUPED (wolves, scorpions, crabs, hounds, sand tyrant)
// ---------------------------------------------------------------------------
export function drawQuadruped(p, spec, pose, anchor) {
  const c = palette(spec);
  const s = spec.s ?? 1;
  const bl = (spec.bodyLen ?? 16) * s;
  const bh = (spec.bodyH ?? 8) * s;
  const legL = (spec.legLen ?? 7) * s;
  const cx = anchor.cx;
  const groundY = anchor.baseY;
  const bodyCY = groundY - legL - bh / 2;
  const pivot = [cx, groundY - legL];
  const xf = makeXf(pivot, pose.rot, pose.bob);
  const legs = pose.legs || [[0, 0], [0, 0], [0, 0], [0, 0]];
  const hipsX = [bl * 0.32, bl * 0.32, -bl * 0.32, -bl * 0.32];
  const hipsY = [bh * 0.25, bh * 0.25, bh * 0.25, bh * 0.25];
  const legTh = Math.max(2, R(1.6 * s + (spec.chunky ? 1 : 0)));
  const bodyCol = c.body;
  const bodyD = c.bodyD ?? darken(bodyCol, 0.3);
  // far legs first (indices 0,2 are far), near legs 1,3
  const legOrder = [0, 2, 1, 3];
  const jointOf = (i) => {
    const hip = [cx + hipsX[i], bodyCY + hipsY[i]];
    const [ang, knee] = legs[i];
    const kneeP = [hip[0] + sn(ang) * legL * 0.55, hip[1] + cs(ang) * legL * 0.55];
    const footP = [kneeP[0] + sn(ang + knee) * legL * 0.5, kneeP[1] + cs(ang + knee) * legL * 0.5];
    return { hip, kneeP, footP };
  };
  for (const i of legOrder) {
    const far = i === 0 || i === 2;
    const j = jointOf(i);
    const lc = far ? darken(bodyCol, 0.25) : (c.leg ?? bodyCol);
    seg(p, xf(...j.hip), xf(...j.kneeP), legTh, lc);
    seg(p, xf(...j.kneeP), xf(...j.footP), legTh, far ? darken(lc, 0.2) : (c.paw ?? darken(lc, 0.15)));
  }
  // Tail (behind body).
  const tailAng = pose.tail ?? 0;
  const tailBase = [cx - bl / 2, bodyCY - bh * 0.1];
  const tailTip = [tailBase[0] - 6 * s + sn(tailAng) * 4 * s, tailBase[1] - 4 * s * cs(tailAng) - (spec.tailUp ?? 3) * s];
  const tailMid = [(tailBase[0] + tailTip[0]) / 2 - 1, (tailBase[1] + tailTip[1]) / 2 - 2];
  if (spec.tail === 'stinger') {
    seg(p, xf(...tailBase), xf(...tailMid), 2, bodyCol);
    seg(p, xf(...tailMid), xf(...tailTip), 2, bodyCol);
    const st = xf(tailTip[0], tailTip[1] - 2);
    p.disc(st[0], st[1], 2, 2, c.stinger ?? col('#ffd34d'));
  } else if (spec.tail === 'bushy') {
    seg(p, xf(...tailBase), xf(...tailTip), 3, bodyCol);
  } else if (spec.tail === 'short') {
    seg(p, xf(...tailBase), xf(...tailTip), 2, bodyCol);
  }
  // Body.
  const bc = xf(cx, bodyCY);
  p.disc(bc[0], bc[1], bl / 2, bh / 2, bodyCol);
  p.disc(bc[0] + 1, bc[1] + bh * 0.3, bl / 2 - 2, bh / 4, c.belly ?? lighten(bodyCol, 0.25));
  if (spec.stripes) {
    for (let k = -2; k <= 2; k += 1) {
      const a = xf(cx + k * bl * 0.18, bodyCY - bh * 0.5);
      const b = xf(cx + k * bl * 0.18 - 1, bodyCY - bh * 0.1);
      p.line(a[0], a[1], b[0], b[1], bodyD, 1);
    }
  }
  if (spec.shell) {
    const sh = xf(cx, bodyCY - bh * 0.3);
    p.disc(sh[0], sh[1] - 1, bl * 0.42, bh * 0.4, c.shell ?? lighten(bodyCol, 0.15));
  }
  // Head.
  const headX = cx + bl / 2 + (spec.headR ?? 3) * s * 0.4 + (pose.headX || 0);
  const headY = bodyCY - bh * 0.15 + (pose.headY || 0);
  const hr = (spec.headR ?? 3.4) * s;
  const hc = xf(headX, headY);
  const eyePos = [hc[0] + hr * 0.45, hc[1] - hr * 0.2];
  if (spec.head === 'wolf') {
    p.disc(hc[0], hc[1], hr * 1.25, hr * 0.95, bodyCol);
    p.poly([xf(headX - hr * 0.3, headY - hr * 0.6), xf(headX - hr * 0.2, headY - hr * 1.7), xf(headX + hr * 0.2, headY - hr * 0.7)], bodyD);
    p.poly([xf(headX + hr * 0.5, headY - hr * 0.5), xf(headX + hr * 0.7, headY - hr * 1.6), xf(headX + hr * 0.9, headY - hr * 0.3)], bodyD);
    p.poly([xf(headX + hr * 0.6, headY + hr * 0.1), xf(headX + hr * 2.0, headY + hr * 0.5), xf(headX + hr * 0.4, headY + hr * 0.6)], c.snout ?? bodyCol);
    p.set(hc[0] + hr * 1.4, hc[1] + hr * 0.1, c.claw ?? col('#f2ead8'));
  } else if (spec.head === 'scorpion') {
    // Pincers and tail are added below.
    p.disc(hc[0], hc[1], hr, hr * 0.7, bodyCol);
  } else if (spec.head === 'tyrant') {
    p.disc(hc[0], hc[1], hr * 1.2, hr * 0.9, bodyCol);
    p.poly([xf(headX + hr * 0.5, headY - hr * 0.2), xf(headX + hr * 1.8, headY + hr * 0.4), xf(headX + hr * 0.4, headY + hr * 0.6)], c.snout ?? bodyD);
  } else {
    p.disc(hc[0], hc[1], hr * 1.1, hr * 0.85, bodyCol);
  }
  // Eyes.
  const eyeCol = pose.eyes === 'closed' ? null : (c.glow ?? c.eye);
  if (eyeCol) {
    p.set(eyePos[0], eyePos[1], spec.glowEyes ? c.glow : c.eye);
    if (spec.glowEyes) p.set(eyePos[0] - 1, eyePos[1], c.glowDark ?? darken(c.glow, 0.3));
  } else {
    p.rect(eyePos[0] - 1, eyePos[1], 2, 1, c.eye);
  }
  if (spec.head === 'scorpion') {
    // Claws at front.
    for (const sg of [-1, 1]) {
      const a = xf(cx + bl / 2 - 1, bodyCY - bh * 0.2 + sg * 2);
      const b = xf(cx + bl / 2 + 3 + (pose.clawOpen || 0) * 0.3, bodyCY - bh * 0.8 + sg * 2 - (pose.clawOpen || 0) * 0.2);
      const cc = xf(cx + bl / 2 + 4 + (pose.clawOpen || 0) * 0.4, bodyCY - bh * 0.1 + sg * 3 + (pose.clawOpen || 0) * 0.4);
      seg(p, a, b, 2, bodyCol);
      p.poly([b, xf(cx + bl / 2 + 5, bodyCY - bh * 0.7 + sg), cc], c.claw ?? darken(bodyCol, 0.1));
    }
  }
  if (spec.head === 'tyrant') {
    for (const sg of [-1, 1]) {
      const a = xf(cx + bl / 2 - 2, bodyCY + sg * bh * 0.5);
      const b = xf(cx + bl / 2 + 5 + (pose.clawOpen || 0) * 0.3, bodyCY - bh * 0.3 + sg * bh * 0.5);
      seg(p, a, b, 3, bodyCol);
      p.poly([b, xf(cx + bl / 2 + 7 + (pose.clawOpen || 0) * 0.3, bodyCY - bh * 0.6 + sg * bh * 0.4), xf(cx + bl / 2 + 5, bodyCY - bh * 0.1 + sg * bh * 0.4)], c.claw ?? darken(bodyCol, 0.1));
    }
  }
  if (spec.spikes) {
    for (let k = -3; k <= 3; k += 1) {
      const a = xf(cx + k * bl * 0.12, bodyCY - bh * 0.5);
      p.poly([a, xf(cx + k * bl * 0.12 - 1, bodyCY - bh * 0.5 - 2.5 * s), xf(cx + k * bl * 0.12 + 1, bodyCY - bh * 0.5)], bodyD);
    }
  }
  if (spec.extra) spec.extra(p, { c, xf, cx, bodyCY, bl, bh, pose, hc }, pose);
  return { head: hc, chest: xf(cx, bodyCY), hip: xf(cx, bodyCY), hand: hc, handB: hc, headR: hr, feet: [xf(cx, groundY)], d: {} };
}

// ---------------------------------------------------------------------------
// DRAGON (flying whelp, frost dragon, elder dragon)
// ---------------------------------------------------------------------------
export function drawDragon(p, spec, pose, anchor) {
  const c = palette(spec);
  const s = spec.s ?? 1;
  const bl = (spec.bodyLen ?? 18) * s;
  const bh = (spec.bodyH ?? 10) * s;
  const legL = (spec.legLen ?? 6) * s;
  const cx = anchor.cx;
  const groundY = anchor.baseY - (pose.lift || 0);
  const bodyCY = groundY - legL - bh / 2 - (spec.flyHeight ?? 0);
  const pivot = [cx, bodyCY];
  const xf = makeXf(pivot, pose.rot, pose.bob);
  const bodyCol = c.body;
  const bodyD = c.bodyD ?? darken(bodyCol, 0.3);
  const wingCol = c.wing ?? darken(bodyCol, 0.1);
  const wingD = c.wingD ?? darken(wingCol, 0.3);
  // Wings (behind body, far wing darker).
  const flap = pose.wing ?? 0; // deg
  const wingPts = (side) => {
    const shoulder = [cx - bl * 0.05, bodyCY - bh * 0.4];
    const span = (spec.wingSpan ?? 22) * s * 0.6;
    const tipY = Math.sin(flap * D2R) * span * 0.9;
    const tip = [shoulder[0] + side * span * 0.5 - span * 0.4 * Math.cos(flap * D2R) * side * 0.2, shoulder[1] - span * 0.8 + tipY];
    const mid = [shoulder[0] + side * span * 0.3, shoulder[1] - span * 0.2 + tipY * 0.4];
    const trail = [shoulder[0] - span * 0.1, shoulder[1] + bh * 0.8];
    return { shoulder, tip, mid, trail };
  };
  if (spec.wings !== false) {
    for (const side of [-1]) {
      const w = wingPts(side);
      p.poly([xf(...w.shoulder), xf(...w.tip), xf(...w.mid), xf(...w.trail)], wingD);
      const w2 = [w.tip, [w.tip[0] + 2 * s, w.tip[1] + 3 * s]];
      p.line(xf(...w.shoulder)[0], xf(...w.shoulder)[1], xf(...w.tip)[0], xf(...w.tip)[1], darken(wingD, 0.3), 1);
      void w2;
    }
  }
  // Legs.
  const legs = pose.legs || [[0, 0], [0, 0], [0, 0], [0, 0]];
  const legTh = Math.max(2, R(1.8 * s));
  const hips = [[bl * 0.25, bh * 0.4], [-bl * 0.25, bh * 0.4]];
  for (let i = 0; i < 2; i += 1) {
    const far = i === 0;
    const hip = [cx + hips[i][0], bodyCY + hips[i][1]];
    const [ang, knee] = legs[i] || [0, 0];
    const kneeP = [hip[0] + sn(ang) * legL * 0.6, hip[1] + cs(ang) * legL * 0.6];
    const footP = [kneeP[0] + sn(ang + knee) * legL * 0.5, kneeP[1] + cs(ang + knee) * legL * 0.5];
    const lc = far ? darken(bodyCol, 0.25) : bodyCol;
    seg(p, xf(...hip), xf(...kneeP), legTh, lc);
    seg(p, xf(...kneeP), xf(...footP), legTh, far ? darken(lc, 0.2) : lighten(bodyCol, 0.05));
  }
  // Tail.
  const tailTip = [cx - bl * 0.6 - 8 * s + (pose.tailSway || 0) * s, bodyCY + bh * 0.2 + 6 * s - (pose.tailLift || 0) * s];
  const tailMid = [cx - bl * 0.5 - 3 * s, bodyCY + bh * 0.3 + 2 * s];
  seg(p, xf(cx - bl * 0.4, bodyCY), xf(...tailMid), Math.max(2, R(3 * s)), bodyCol);
  seg(p, xf(...tailMid), xf(...tailTip), Math.max(1, R(2 * s)), bodyCol);
  // Body.
  const bc = xf(cx, bodyCY);
  p.disc(bc[0], bc[1], bl / 2, bh / 2, bodyCol);
  p.disc(bc[0] + 1, bc[1] + bh * 0.25, bl / 2 - 3, bh / 4, c.belly ?? lighten(bodyCol, 0.3));
  if (spec.scales) {
    for (let k = -2; k <= 2; k += 1) for (let j = -1; j <= 1; j += 1) {
      const sp = xf(cx + k * bl * 0.2 + (j % 2) * 2, bodyCY + j * bh * 0.25);
      p.set(sp[0], sp[1], bodyD);
    }
  }
  // Neck and head.
  const neckAng = pose.neck ?? 0;
  const neckBase = [cx + bl * 0.42, bodyCY - bh * 0.25];
  const neckTop = [neckBase[0] + sn(neckAng) * bh * 0.6 + bh * 0.3, neckBase[1] - cs(neckAng) * bh * 0.6 - bh * 0.5];
  const neckMid = [(neckBase[0] + neckTop[0]) / 2 + 1, (neckBase[1] + neckTop[1]) / 2];
  seg(p, xf(...neckBase), xf(...neckMid), Math.max(3, R(3.4 * s)), bodyCol);
  seg(p, xf(...neckMid), xf(...neckTop), Math.max(3, R(3 * s)), bodyCol);
  const hc = xf(neckTop[0] + bh * 0.3 + (pose.headX || 0) * s, neckTop[1] + (pose.headY || 0) * s);
  const hr = (spec.headR ?? 4) * s;
  p.disc(hc[0], hc[1], hr * 1.3, hr * 0.9, bodyCol);
  // Snout / jaw.
  const jawOpen = pose.jaw ?? 0;
  p.poly([[hc[0] + hr * 0.5, hc[1] - hr * 0.3], [hc[0] + hr * 2.4, hc[1] - hr * 0.1], [hc[0] + hr * 0.5, hc[1] + hr * 0.3]], bodyCol);
  p.poly([[hc[0] + hr * 0.5, hc[1] + hr * 0.2], [hc[0] + hr * 2.0, hc[1] + hr * 0.2 + jawOpen], [hc[0] + hr * 0.3, hc[1] + hr * 0.7 + jawOpen]], bodyD);
  // Horns.
  const hornC = c.horn ?? col('#e8dcc0');
  p.line(hc[0] - hr * 0.3, hc[1] - hr * 0.8, hc[0] - hr * 1.1, hc[1] - hr * 2.2, hornC, 1);
  p.line(hc[0] + hr * 0.2, hc[1] - hr * 0.8, hc[0] + hr * 0.2, hc[1] - hr * 2.4, hornC, 1);
  // Eye.
  p.set(hc[0] + hr * 0.6, hc[1] - hr * 0.3, pose.eyes === 'closed' ? c.eye : (c.glow ?? c.eye));
  if (pose.eyes === 'closed') p.rect(hc[0] + hr * 0.3, hc[1] - hr * 0.3, 2, 1, c.eye);
  // Near wing (front).
  if (spec.wings !== false) {
    const w = wingPts(1);
    const pts = [xf(...w.shoulder), xf(...w.tip), xf(...w.mid), xf(...w.trail)];
    p.poly(pts, wingCol);
    p.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], darken(wingCol, 0.3), 1);
    const m1 = xf(w.mid[0] + 0, w.mid[1] + 2);
    p.set(m1[0], m1[1], lighten(wingCol, 0.3));
  }
  if (spec.extra) spec.extra(p, { c, xf, cx, bodyCY, bl, bh, hc, pose }, pose);
  return { head: hc, chest: xf(cx, bodyCY), hip: xf(cx, bodyCY), hand: hc, handB: hc, headR: hr, feet: [xf(cx, groundY)], d: {} };
}

// ---------------------------------------------------------------------------
// FLOATING (eyes, wisps, robed overlords)
// ---------------------------------------------------------------------------
export function drawFloating(p, spec, pose, anchor) {
  const c = palette(spec);
  const s = spec.s ?? 1;
  const r = (spec.radius ?? 9) * s;
  const cx = anchor.cx + (pose.sway || 0) * s * 0.4;
  const cy = anchor.baseY - r * 2 - (spec.floatH ?? 4) * s + (pose.bob || 0);
  const xf = makeXf([cx, cy], pose.rot, 0);
  const bodyCol = c.body;
  const bodyD = c.bodyD ?? darken(bodyCol, 0.35);
  // Trailing tail / robe.
  const sway = (pose.sway || 0) * s;
  const tailLen = (spec.tailLen ?? 14) * s;
  const tailSegs = 5;
  for (let k = 0; k < tailSegs; k += 1) {
    const t0 = k / tailSegs, t1 = (k + 1) / tailSegs;
    const y0 = cy + r * 0.6 + t0 * tailLen;
    const y1 = cy + r * 0.6 + t1 * tailLen;
    const x0 = cx + Math.sin((pose.wave || 0) + t0 * 4) * (2 + 3 * t0) * s + sway * t0;
    const x1 = cx + Math.sin((pose.wave || 0) + t1 * 4) * (2 + 3 * t1) * s + sway * t1;
    const w = Math.max(1, R((r * 0.9) * (1 - t0) * 0.9));
    if (spec.robed) {
      p.line(x0, y0, x1, y1, bodyD, Math.max(2, w));
    } else {
      p.line(x0, y0, x1, y1, k % 2 ? bodyD : bodyCol, Math.max(1, w - 1));
    }
  }
  if (spec.robed) {
    p.poly([xf(cx - r, cy), xf(cx + r, cy), xf(cx + r * 1.3, cy + r * 2.6), xf(cx - r * 1.3, cy + r * 2.6)], c.robe ?? bodyD);
  }
  const b = xf(cx, cy);
  p.disc(b[0], b[1], r, r * 0.95, bodyCol);
  p.disc(b[0] - r * 0.25, b[1] - r * 0.3, r * 0.45, r * 0.35, lighten(bodyCol, 0.3));
  // Eyes.
  const eyes = spec.eyes ?? 1;
  const eyeC = c.glow ?? c.eye;
  for (let i = 0; i < eyes; i += 1) {
    const ox = eyes === 1 ? 0 : (i - (eyes - 1) / 2) * r * 0.55;
    const ex = b[0] + ox + (pose.lookX || 0) * s;
    const ey = b[1] + (pose.eyeY ?? 0) * s;
    if (pose.eyes === 'closed') {
      p.rect(ex - 1, ey, 2, 1, c.eye);
    } else {
      p.disc(ex, ey, Math.max(1.2, r * 0.25), Math.max(1.2, r * 0.25), c.eye);
      p.set(ex, ey, eyeC);
    }
  }
  if (spec.spikes) {
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2 + (pose.spin || 0);
      const inner = [b[0] + Math.cos(a) * r * 0.9, b[1] + Math.sin(a) * r * 0.9];
      const outer = [b[0] + Math.cos(a) * r * 1.4, b[1] + Math.sin(a) * r * 1.4];
      p.line(inner[0], inner[1], outer[0], outer[1], c.glow ?? bodyCol, 1);
    }
  }
  if (spec.extra) spec.extra(p, { c, xf, cx, cy, r, b, pose, s }, pose);
  return { head: b, chest: b, hip: [cx, cy + r], hand: [cx + r, cy], handB: [cx - r, cy], headR: r, feet: [[cx, cy + r * 2]], d: {} };
}

// ---------------------------------------------------------------------------
// TREE (ancient forest guardian)
// ---------------------------------------------------------------------------
export function drawTree(p, spec, pose, anchor) {
  const c = palette(spec);
  const s = spec.s ?? 1;
  const cx = anchor.cx;
  const base = anchor.baseY;
  const trunkW = (spec.trunkW ?? 18) * s;
  const trunkH = (spec.trunkH ?? 34) * s;
  const top = base - trunkH - (spec.rootH ?? 6) * s;
  const xf = makeXf([cx, base], pose.rot, pose.bob);
  const barkC = c.body;
  const barkD = c.bodyD ?? darken(barkC, 0.3);
  // Roots.
  for (const [dx, lean] of [[-1, pose.rootL ?? 0], [0, 0], [1, pose.rootR ?? 0]]) {
    const a = [cx + dx * trunkW * 0.3, base - (spec.rootH ?? 6) * s];
    const b = [cx + dx * trunkW * 0.9 + lean * 2, base];
    seg(p, xf(...a), xf(...b), Math.max(2, R(3 * s)), barkD);
  }
  // Trunk.
  const tTop = [cx - trunkW / 2, top];
  p.poly([xf(cx - trunkW / 2, base - (spec.rootH ?? 6) * s), xf(cx + trunkW / 2, base - (spec.rootH ?? 6) * s), xf(cx + trunkW * 0.42, top), xf(tTop[0] + trunkW * 0.1, top)], barkC);
  // Bark lines.
  for (let k = 0; k < 4; k += 1) {
    const x = cx - trunkW * 0.3 + k * trunkW * 0.2;
    const a = xf(x, top + 4 * s);
    const b = xf(x + 1, base - 8 * s);
    p.line(a[0], a[1], b[0], b[1], barkD, 1);
  }
  // Glowing face.
  const fy = top + trunkH * 0.35;
  const e1 = xf(cx - trunkW * 0.22, fy), e2 = xf(cx + trunkW * 0.12, fy);
  const eyeOn = pose.eyes === 'closed' ? c.eye : c.glow;
  if (pose.eyes === 'closed') {
    p.rect(e1[0] - 1, e1[1], 3, 1, c.eye);
    p.rect(e2[0] - 1, e2[1], 3, 1, c.eye);
  } else {
    p.disc(e1[0], e1[1], 2, 1.5, c.eye);
    p.disc(e2[0], e2[1], 2, 1.5, c.eye);
    p.set(e1[0], e1[1], eyeOn);
    p.set(e2[0], e2[1], eyeOn);
  }
  const mouth = xf(cx - trunkW * 0.05, fy + 5 * s + (pose.jaw || 0));
  p.rect(mouth[0] - 2, mouth[1], 4, 1, c.eye);
  // Leaves crown.
  const crown = xf(cx, top - 5 * s);
  p.disc(crown[0], crown[1], trunkW * 0.8 + (pose.crown || 0), trunkW * 0.55, c.leaf ?? col('#3e9a4a'));
  p.disc(crown[0] - 4 * s, crown[1] - 1, trunkW * 0.4, trunkW * 0.3, c.leafL ?? col('#7fdc78'));
  // Arms (branches).
  const armPose = pose.arms || [[-30, 0], [30, 0]];
  const shoulders = [xf(cx - trunkW * 0.45, top + trunkH * 0.5), xf(cx + trunkW * 0.45, top + trunkH * 0.5)];
  const armLen = (spec.armLen ?? 26) * s;
  const handsOut = [];
  armPose.forEach(([ang, bend], i) => {
    const sh = shoulders[i];
    const el = [sh[0] + sn(ang) * armLen * 0.5, sh[1] + cs(ang) * armLen * 0.5];
    const hd = [el[0] + sn(ang + bend) * armLen * 0.5, el[1] + cs(ang + bend) * armLen * 0.5];
    const th = Math.max(2, R(4 * s));
    seg(p, sh, el, th, i === 0 ? darken(barkC, 0.1) : barkC);
    seg(p, el, hd, Math.max(2, th - 1), barkC);
    // leaves on branch tip
    p.disc(hd[0], hd[1], 3 * s, 2.5 * s, c.leaf ?? col('#3e9a4a'));
    handsOut.push(hd);
  });
  if (spec.extra) spec.extra(p, { c, xf, cx, base, top, trunkW, trunkH, hands: handsOut, pose }, pose);
  return { head: xf(cx, top), chest: xf(cx, top + trunkH * 0.4), hip: xf(cx, base - 10 * s), hand: handsOut[1] || [cx, top], handB: handsOut[0] || [cx, top], headR: trunkW * 0.5, feet: [xf(cx, base)], d: {} };
}

// ---------------------------------------------------------------------------
// TENTACLE (kraken)
// ---------------------------------------------------------------------------
export function drawTentacle(p, spec, pose, anchor) {
  const c = palette(spec);
  const s = spec.s ?? 1;
  const cx = anchor.cx;
  const base = anchor.baseY;
  const mR = (spec.mantleR ?? 14) * s;
  const mY = base - mR * 1.2 - (pose.lift || 0);
  const xf = makeXf([cx, mY], pose.rot, pose.bob);
  const bodyCol = c.body;
  const bodyD = c.bodyD ?? darken(bodyCol, 0.3);
  const n = spec.arms ?? 6;
  const phase = pose.wave || 0;
  for (let i = 0; i < n; i += 1) {
    const frac = (i + 0.5) / n;
    const startX = cx + (frac - 0.5) * mR * 1.6;
    const startY = mY + mR * 0.4;
    const spread = (frac - 0.5) * 2;
    let prev = [startX, startY];
    const segs = 6;
    const far = i % 2 === 0;
    for (let k = 1; k <= segs; k += 1) {
      const t = k / segs;
      const x = startX + spread * t * (mR * 0.9) + Math.sin(phase + i * 1.1 + t * 4) * (3 + 3 * t) * s;
      const y = startY + t * (base - startY) * 0.95 - Math.abs(Math.cos(phase + i + t * 3)) * 2 * s * t;
      const th = Math.max(1, R((2.5 - 1.6 * t) * s));
      const col2 = far ? darken(bodyCol, 0.25) : bodyCol;
      p.line(...xf(prev[0], prev[1]), ...xf(x, y), col2, th);
      if (k % 2 === 0) {
        const sp = xf(x, y);
        p.set(sp[0], sp[1], c.sucker ?? lighten(bodyCol, 0.4));
      }
      prev = [x, y];
    }
  }
  // Mantle (head dome).
  const m = xf(cx, mY);
  p.disc(m[0], m[1], mR, mR * 0.95, bodyCol);
  p.disc(m[0] - mR * 0.2, m[1] - mR * 0.4, mR * 0.5, mR * 0.35, lighten(bodyCol, 0.25));
  p.disc(m[0], m[1] + mR * 0.5, mR * 0.9, mR * 0.35, bodyD);
  // Eyes.
  const eyeR = Math.max(1.5, R(2.4 * s));
  for (const ex of [-mR * 0.45, mR * 0.35]) {
    const e = xf(cx + ex, mY + mR * 0.05);
    if (pose.eyes === 'closed') p.rect(e[0] - 2, e[1], 4, 1, c.eye);
    else {
      p.disc(e[0], e[1], eyeR, eyeR, c.eye);
      p.set(e[0], e[1], c.glow ?? col('#ffe27a'));
    }
  }
  if (spec.extra) spec.extra(p, { c, xf, cx, mY, mR, pose }, pose);
  return { head: m, chest: m, hip: m, hand: m, handB: m, headR: mR, feet: [xf(cx, base)], d: {} };
}

// Dispatch table used by the frame renderer.
export const RIGS = {
  humanoid: drawHumanoid,
  quadruped: drawQuadruped,
  dragon: drawDragon,
  floating: drawFloating,
  tree: drawTree,
  tentacle: drawTentacle,
};

// Overlay effects drawn after outlining: ring, arc (slash trail), sparks, beam.
function drawFx(p, fx, A) {
  const get = (anchor) => (anchor && A[anchor]) || A.chest;
  switch (fx.type) {
    case 'ring': {
      const o = get(fx.at || 'hip');
      p.ring(o[0], o[1] + (fx.dy || 0), fx.r, (fx.ry ?? fx.r) * 0.5, fx.color, fx.th || 1);
      break;
    }
    case 'disc': {
      const o = get(fx.at || 'hip');
      p.disc(o[0], o[1] + (fx.dy || 0), fx.r, fx.r, fx.color);
      break;
    }
    case 'arc': {
      const o = get(fx.at || 'chest');
      const steps = Math.max(4, Math.round(Math.abs(fx.to - fx.from) / 6));
      let prev = null;
      for (let k = 0; k <= steps; k += 1) {
        const a = (fx.from + ((fx.to - fx.from) * k) / steps) * D2R;
        const pt = [o[0] + Math.cos(a) * fx.r, o[1] - Math.sin(a) * fx.r];
        if (prev) p.line(prev[0], prev[1], pt[0], pt[1], fx.color, fx.th || 1);
        prev = pt;
      }
      break;
    }
    case 'sparks': {
      const o = get(fx.at || 'chest');
      const rnd = mulberry(fx.seed || 1);
      for (let k = 0; k < (fx.n || 6); k += 1) {
        const a = rnd() * Math.PI * 2;
        const d = fx.r * (0.4 + rnd() * 0.6);
        p.set(o[0] + Math.cos(a) * d, o[1] + Math.sin(a) * d, fx.color);
      }
      break;
    }
    case 'beam': {
      const o = get(fx.at || 'hand');
      const a = fx.angle * D2R;
      p.line(o[0], o[1], o[0] + Math.cos(a) * fx.len, o[1] - Math.sin(a) * fx.len, fx.color, fx.th || 2);
      break;
    }
    case 'streak': {
      const o = get(fx.at || 'hip');
      for (let k = 0; k < (fx.n || 3); k += 1) {
        const y = o[1] - 10 + k * 7;
        p.line(o[0] - fx.len - k * 2, y, o[0] - 4, y, fx.color, 1);
      }
      break;
    }
    default:
      break;
  }
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Renders one frame: body -> outline/shade -> overlays.
export function renderFrame(spec, pose, [fw, fh]) {
  const p = new Pix(fw, fh);
  const anchor = { cx: spec.cx ?? fw / 2, baseY: spec.baseY ?? fh - (spec.bottomPad ?? 4) };
  const rig = RIGS[spec.rig];
  if (!rig) throw new Error(`Unknown rig ${spec.rig}`);
  const A = rig(p, spec, pose, anchor);
  let out = bake(p, { outline: spec.outline ?? '#140c1c', shade: spec.shade !== false });
  if (pose.flash) {
    const res = out.clone();
    for (let i = 0; i < res.d.length; i += 1) {
      const v = res.d[i];
      if ((v & 0xff) === 0 || v === C(spec.outline ?? '#140c1c')) continue;
      res.d[i] = mix(v, 0xffffffff, 0.6);
    }
    out = res;
  }
  if (pose.tint) {
    const res = out.clone();
    const tc = typeof pose.tint === 'string' ? C(pose.tint) : pose.tint;
    for (let i = 0; i < res.d.length; i += 1) {
      const v = res.d[i];
      if ((v & 0xff) === 0 || v === C(spec.outline ?? '#140c1c')) continue;
      res.d[i] = mix(v, tc, 0.45);
    }
    out = res;
  }
  out.bodyOnly = out.clone();
  for (const fx of pose.fx || []) drawFx(out, fx, A);
  return out;
}

export { palette, humanoidDims as dims };
export const PAL_KEYS = ['skin', 'hair', 'cloth', 'armor', 'metal', 'glow'];
