// Character art specs (heroes, enemies, bosses) and their animation tables.
// Every entry becomes its own sprite sheet. Animation names match the game engine.
import { ENEMIES, BOSSES, HEROES } from '../../shared/data.js';
import { darken } from './pix.mjs';

const P2 = Math.PI * 2;
const sin = Math.sin;
const cos = Math.cos;
const frames = (n, fn) => Array.from({ length: n }, (_, i) => fn(i, n));
const st = 3;

export const HERO_ANIMS = [
  ['idle', 4, 6, true], ['walk', 6, 10, true], ['run', 6, 12, true], ['attack', 4, 14, false],
  ['combo', 6, 14, false], ['special', 6, 10, false], ['hit', 2, 12, false], ['dodge', 4, 14, false],
  ['defeat', 6, 8, false], ['victory', 4, 6, true],
];
export const MOB_ANIMS = [
  ['idle', 4, 6, true], ['move', 6, 8, true], ['attack', 5, 9, false],
  ['special', 5, 7, false], ['hit', 2, 10, false], ['defeat', 6, 8, false],
];
export const BOSS_ANIMS = [
  ['idle', 4, 6, true], ['move', 6, 8, true], ['basic', 5, 9, false], ['heavy', 6, 7, false],
  ['special', 6, 7, false], ['aoe', 6, 7, false], ['hit', 2, 10, false], ['phase', 4, 6, false], ['defeat', 6, 6, false],
];

// ---------------------------------------------------------------------------
// Shared humanoid motion helpers (angles in degrees).
// ---------------------------------------------------------------------------
function walk(n, { A = 26, L = 30, armA = 28, bob = 1.5, lean = 0, hunch = 0, aim = null, elbow = 15 }) {
  return frames(n, (i) => {
    const p = (P2 * i) / n;
    const pb = p + Math.PI;
    const lf = [A * sin(p), -L * Math.max(0, cos(p))];
    const lb = [A * sin(pb), -L * Math.max(0, cos(pb))];
    const pose = {
      bob: -Math.round(Math.abs(sin(p)) * bob), lean, hunch, lf, lb,
      af: [10 - armA * sin(p), elbow], ab: [-10 + armA * sin(p), 12],
    };
    if (aim != null) { pose.aim = aim; pose.af = undefined; }
    return pose;
  });
}

// Basic weapon swing across n frames; hit frames are provided separately as the game expects.
function swing(n, aims, leans, extra = {}) {
  return frames(n, (i) => ({ aim: aims[i], lean: leans[i] ?? 0, lf: [st, 0], lb: [-st, 0], ab: [-18, 12], ...extra(i) }));
}

// ---------------------------------------------------------------------------
// HUMANOID set: heroes (walk/run/combo/dodge/victory), mobs (move/attack/special), bosses (basic/heavy/aoe/phase).
// ---------------------------------------------------------------------------
export function humanoidAnim(name, n, spec) {
  const glowFx = spec.glowFx || spec.glow || '#ffe27a';
  const trail = spec.trail || glowFx;
  const L = spec.reach ?? 20;
  const idleAim = spec.idleAim ?? -72;
  const shamble = spec.motion === 'shamble';
  switch (name) {
    case 'idle':
      return frames(n, (i) => ({
        bob: Math.round(sin((P2 * i) / n)), lf: [st, 0], lb: [-st, 0],
        aim: shamble ? null : idleAim, af: shamble ? [70, 16] : undefined,
        ab: shamble ? [62, 14] : [-16, 12], lean: shamble ? 2 : 0, hunch: spec.hunch ?? 0,
      }));
    case 'walk':
      return walk(n, { A: 26, L: 30, armA: 30, bob: 1.5 });
    case 'run':
      return walk(n, { A: 40, L: 52, armA: 52, bob: 2.5, lean: 2, hunch: 8 });
    case 'move':
      if (shamble) return walk(n, { A: 18, L: 20, armA: 0, bob: 2, hunch: 10, lean: 1 }).map((p) => ({ ...p, af: [72, 16], ab: [62, 14] }));
      if (spec.motion === 'hop') return walk(n, { A: 34, L: 40, armA: 40, bob: 3, lean: 2 });
      return walk(n, { A: 27, L: 30, armA: 30, bob: 1.5, hunch: spec.hunch ?? 0 });
    case 'attack': // enemy basic: windup, strike (active frames 2-3), recover
      return frames(n, (i) => {
        const aims = [150, 100, 25, -35, -65];
        const leans = [-2, 0, 4, 6, 2];
        const pose = { aim: aims[i] ?? -65, lean: leans[i] ?? 0, lf: [st, 0], lb: [-st, 0], ab: [-18, 12] };
        if (i === 2) pose.fx = [{ type: 'arc', from: 150, to: -35, r: L, color: trail, at: 'chest', th: 1 }];
        if (i === 3) pose.fx = [{ type: 'sparks', at: 'hand', n: 3, r: 4, color: glowFx, seed: 3 }];
        return pose;
      });
    case 'hero_attack':
      return frames(n, (i) => {
        const aims = [150, 40, -30, -65];
        const leans = [-2, 4, 5, 0];
        const pose = { aim: aims[i], lean: leans[i], lf: [st, 0], lb: [-st, 0], ab: [-18, 12] };
        if (i === 1) pose.fx = [{ type: 'arc', from: 150, to: 40, r: L, color: trail, at: 'chest', th: 1 }];
        if (i === 2) pose.fx = [{ type: 'arc', from: 40, to: -30, r: L, color: trail, at: 'chest', th: 2 }];
        return pose;
      });
    case 'combo':
      return frames(n, (i) => {
        const aims = [170, 60, -10, 100, -80, -90];
        const leans = [-2, 2, 5, -3, 10, 6];
        const pose = {
          aim: aims[i], lean: leans[i], lf: i >= 3 ? [18, -4] : [st, 0], lb: i >= 3 ? [-10, 0] : [-st, 0], ab: [-18, 12],
        };
        if (i === 0) pose.fx = [];
        if (i === 1) pose.fx = [{ type: 'arc', from: 170, to: 60, r: L, color: trail, at: 'chest', th: 1 }];
        if (i === 2) pose.fx = [{ type: 'arc', from: 60, to: -10, r: L, color: trail, at: 'chest', th: 2 }];
        if (i === 4) pose.fx = [{ type: 'arc', from: 100, to: -80, r: L + 3, color: glowFx, at: 'chest', th: 2 }];
        if (i === 5) pose.fx = [{ type: 'sparks', at: 'hand', n: 6, r: 6, color: glowFx, seed: 7 }];
        if (i === 5) pose.bob = 2;
        return pose;
      });
    case 'special':
      return frames(n, (i) => {
        const aims = [70, 90, 90, 0, -10, -40];
        const pose = { aim: aims[i], aimB: [100, 110, 110, 40, 20, -10][i], lean: [-2, -2, 0, 6, 5, 2][i], lf: [st, 0], lb: [-st, 0] };
        if (i === 1) pose.fx = [{ type: 'ring', at: 'hip', r: 9, ry: 9, color: glowFx, th: 1 }];
        if (i === 2) pose.fx = [{ type: 'ring', at: 'hip', r: 13, ry: 13, color: glowFx, th: 1 }, { type: 'sparks', at: 'chest', n: 8, r: 14, color: glowFx, seed: 11 }];
        if (i === 3) pose.fx = [{ type: 'beam', at: 'hand', angle: 0, len: 46, color: glowFx, th: 3 }, { type: 'beam', at: 'hand', angle: 0, len: 46, color: spec.glowLight || '#ffffff', th: 1 }];
        if (i === 4) pose.fx = [{ type: 'beam', at: 'hand', angle: -4, len: 40, color: glowFx, th: 2 }];
        return pose;
      });
    case 'hit':
      return frames(n, (i) => ({
        lean: i === 0 ? -4 : -2, hunch: i === 0 ? -8 : -4, head: [-2, 1], flash: i === 0,
        eyes: i === 0 ? 'angry' : 'open', lf: [st, 0], lb: [-st, 0],
        aim: i === 0 ? 0 : -40, ab: [-30, 20],
      }));
    case 'dodge':
      return frames(n, (i) => {
        const lfs = [[40, -30], [48, -26], [-30, 20], [-10, 6]];
        const lbs = [[-30, 20], [-42, 18], [42, -20], [18, -6]];
        const pose = { lean: [14, 22, 18, 6][i], lf: lfs[i], lb: lbs[i], rot: [-12, -20, -16, -6][i], aim: 10, ab: [-40, 10] };
        if (i < 3) pose.fx = [{ type: 'streak', at: 'hip', n: 3, len: 14 - i * 3, color: spec.trail || '#ffffff' }];
        return pose;
      });
    case 'defeat':
    case 'defeat_h':
      return frames(n, (i) => {
        const pose = {
          rot: [0, -20, -45, -70, -85, -90][i], bob: [0, 2, 4, 6, 8, 10][i],
          eyes: i >= 3 ? 'x' : 'open', lean: 0, lf: [st + i * 2, 0], lb: [-st - i, 0], aim: -70 + i * 10, ab: [-20 + i * 20, 12],
        };
        if (i >= 4) pose.fx = [{ type: 'sparks', at: 'chest', n: 4, r: 10, color: glowFx, seed: 5 + i }];
        return pose;
      });
    case 'victory':
      return frames(n, (i) => ({
        bob: [0, -4, -6, -2][i], aim: [90, 100, 80, 90][i], aimB: [100, 110, 90, 100][i],
        lean: 0, lf: [st, 0], lb: [-st, 0], eyes: 'open',
        fx: i === 1 ? [{ type: 'sparks', at: 'chest', n: 6, r: 16, color: glowFx, seed: 9 }] : undefined,
      }));
    case 'basic': // boss basic (bigger swings)
      return frames(n, (i) => {
        const aims = [160, 110, 30, -40, -70];
        const leans = [-3, 0, 6, 8, 2];
        const pose = { aim: aims[i], lean: leans[i], lf: [st, 0], lb: [-st, 0], ab: [-18, 12] };
        if (i === 1) pose.fx = [{ type: 'arc', from: 160, to: 30, r: L, color: trail, at: 'chest', th: 2 }];
        if (i === 2) pose.fx = [{ type: 'arc', from: 30, to: -40, r: L, color: trail, at: 'chest', th: 2 }];
        if (i === 3) pose.fx = [{ type: 'sparks', at: 'hand', n: 5, r: 6, color: glowFx, seed: 4 }];
        return pose;
      });
    case 'heavy':
      return frames(n, (i) => {
        const aims = [170, 130, 90, -70, -90, -80];
        const leans = [-4, -6, -2, 10, 12, 6];
        const pose = { aim: aims[i], lean: leans[i], bob: [0, -2, -4, 2, 4, 2][i], lf: [st, 0], lb: [-st, 0], ab: [-18, 12] };
        if (i < 2) pose.tint = '#ff3a3a'; // telegraph
        if (i === 3) pose.fx = [{ type: 'ring', at: 'hip', r: 14, ry: 6, color: glowFx, th: 1 }];
        if (i === 4) pose.fx = [{ type: 'ring', at: 'hip', r: 22, ry: 9, color: glowFx, th: 1 }, { type: 'sparks', at: 'hand', n: 8, r: 16, color: glowFx, seed: 2 }];
        return pose;
      });
    case 'aoe':
      return frames(n, (i) => {
        const pose = {
          aim: [100, 140, 160, -80, -90, -90][i], aimB: [120, 150, 170, -80, -90, -90][i],
          bob: [0, -4, -6, 4, 6, 2][i], lean: [0, -2, -4, 6, 8, 4][i], lf: [st, 0], lb: [-st, 0],
        };
        if (i >= 3) pose.fx = [{ type: 'ring', at: 'hip', r: [0, 0, 0, 10, 18, 26][i], ry: [0, 0, 0, 4, 7, 10][i], color: glowFx, th: 1 }];
        return pose;
      });
    case 'phase':
      return frames(n, (i) => ({
        aim: [60, 80, 100, 80][i], aimB: [60, 80, 100, 80][i], bob: [0, -2, -3, -1][i],
        lean: [-2, 0, 2, 0][i], lf: [st, 0], lb: [-st, 0], eyes: 'glow', flash: i % 2 === 1,
        fx: [{ type: 'ring', at: 'chest', r: 10 + i * 4, ry: 6 + i * 2, color: glowFx, th: 1 }],
      }));
    default:
      throw new Error(`Unknown humanoid animation ${name}`);
  }
}

// Mob/hero special (enemy special types).
export function humanoidSpecial(n, spec) {
  const t = spec.special?.type || 'projectile';
  const glowFx = spec.glowFx || spec.glow || '#ffe27a';
  if (t === 'aoe') {
    return frames(n, (i) => ({
      aim: [40, 60, 80, -60, -70][i], aimB: [120, 130, 150, -70, -80][i], lf: [st, 0], lb: [-st, 0], lean: [0, 2, 4, 6, 2][i],
      fx: i >= 2 ? [{ type: 'ring', at: 'hip', r: [0, 0, 6, 10, 14][i], ry: [0, 0, 2, 4, 5][i], color: glowFx, th: 1 }] : undefined,
    }));
  }
  if (t === 'dash' || t === 'lunge' || t === 'leap') {
    return frames(n, (i) => ({
      lean: [0, 6, 14, 14, 4][i], lf: [[25, -10], [40, -20], [50, -30], [30, -5], [5, 0]][i], lb: [[-20, 0], [-40, 10], [-50, 20], [-30, 8], [-5, 0]][i],
      aim: [-30, 0, 20, -10, -40][i], ab: [-40, 10], bob: [0, -1, -2, 0, 0][i],
      fx: i >= 1 && i <= 3 ? [{ type: 'streak', at: 'hip', n: 2, len: 10, color: spec.trail || '#ffffff' }] : undefined,
    }));
  }
  if (t === 'teleport') {
    return frames(n, (i) => ({
      eyes: i < 2 ? 'closed' : 'glow', aim: [-60, -20, 20, 0, -40][i], lf: [st, 0], lb: [-st, 0],
      fx: i >= 1 ? [{ type: 'sparks', at: 'chest', n: 8, r: 12 - i, color: glowFx, seed: 20 + i }] : undefined,
    }));
  }
  // projectile (default)
  return frames(n, (i) => ({
    aim: [60, 90, 0, -10, -40][i], lean: [-2, -2, 0, 3, 2][i], lf: [st, 0], lb: [-st, 0],
    fx: i === 2 ? [{ type: 'beam', at: 'hand', angle: 0, len: 24, color: glowFx, th: 2 }, { type: 'sparks', at: 'hand', n: 3, r: 3, color: glowFx, seed: 30 }] : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Quadruped set (wolves, scorpions, crabs, hounds, sand tyrant basic/heavy/special/aoe).
// ---------------------------------------------------------------------------
export function quadAnim(name, n, spec) {
  const glowFx = spec.glowFx || spec.glow || '#ffe27a';
  const legs = (fn) => frames(n, (i) => fn(i, n));
  switch (name) {
    case 'idle':
      return legs((i, n) => ({ bob: Math.round(sin((P2 * i) / n)), tail: 6 * sin((P2 * i) / n), legs: [[0, 0], [0, 0], [0, 0], [0, 0]], eyes: 'open' }));
    case 'move':
    case 'walk':
      return legs((i, n) => {
        const p = (P2 * i) / n;
        const a = (ph) => [24 * sin(ph), -26 * Math.max(0, cos(ph))];
        return { bob: -Math.round(Math.abs(sin(p)) * 1.5), legs: [a(p), a(p + Math.PI), a(p + Math.PI), a(p)], tail: 10 * sin(p), headX: 0 };
      });
    case 'attack':
    case 'basic':
      return legs((i) => ({
        headX: [0, 2, 5, 4, 1][i] ?? 0, legs: [[-6, 0], [-6, 0], [6, 0], [6, 0]], clawOpen: [0, 4, 8, 8, 3][i] ?? 0,
        fx: i === 2 ? [{ type: 'sparks', at: 'head', n: 4, r: 4, color: glowFx, seed: 40 }] : undefined,
      }));
    case 'heavy':
      return legs((i) => ({
        bob: [0, -3, -6, 3, 4, 1][i] ?? 0, legs: [[-30, -20], [-30, -20], [8, 0], [8, 0]], clawOpen: [2, 6, 10, 10, 4, 2][i] ?? 0,
        tint: i < 2 ? '#ff3a3a' : undefined,
        fx: i === 3 ? [{ type: 'ring', at: 'hip', r: 14, ry: 5, color: glowFx, th: 1 }] : undefined,
      }));
    case 'special':
      return legs((i) => ({
        headY: [0, -2, -3, -3, -1, 0][i] ?? 0, headX: [0, 1, 2, 2, 1, 0][i] ?? 0, jaw: [0, 2, 3, 3, 1, 0][i] ?? 0, tail: 14,
        legs: [[0, 0], [0, 0], [0, 0], [0, 0]],
        fx: i >= 2 && i <= 4 ? [{ type: 'beam', at: 'head', angle: 5 - (i - 2) * 3, len: 26, color: glowFx, th: 2 }] : undefined,
      }));
    case 'aoe':
      return legs((i) => ({
        bob: [0, -3, -4, 0, 1, 0][i] ?? 0, legs: [[10, 0], [10, 0], [10, 0], [10, 0]],
        fx: i >= 2 ? [{ type: 'ring', at: 'hip', r: [0, 0, 8, 14, 20, 26][i], ry: [0, 0, 3, 5, 7, 9][i], color: glowFx, th: 1 }] : undefined,
      }));
    case 'hit':
      return legs((i) => ({ rot: i === 0 ? -6 : -3, headX: -2, flash: i === 0, eyes: 'open' }));
    case 'phase':
      return legs((i) => ({
        bob: [0, -2, 0, -1][i], flash: i % 2 === 1, eyes: 'glow',
        fx: [{ type: 'ring', at: 'hip', r: 12 + i * 4, ry: 4 + i, color: glowFx, th: 1 }],
      }));
    case 'defeat':
      return legs((i) => ({
        rot: [0, -20, -45, -70, -85, -90][i], bob: [0, 2, 4, 6, 8, 10][i], eyes: 'closed',
      }));
    default:
      throw new Error(`Unknown quad animation ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Dragon set.
// ---------------------------------------------------------------------------
export function dragonAnim(name, n, spec) {
  const glowFx = spec.glowFx || spec.glow || '#ffe27a';
  const F = (fn) => frames(n, (i) => fn(i, n));
  switch (name) {
    case 'idle':
      return F((i, n) => ({ wing: 30 * sin((P2 * i) / n), neck: 6 * sin((P2 * i) / n), bob: Math.round(sin((P2 * i) / n) * 2), legs: [[0, 0], [0, 0]] }));
    case 'move':
    case 'walk':
      return F((i, n) => {
        const p = (P2 * i) / n;
        return { wing: 40 * sin(2 * p), bob: -Math.round(Math.abs(sin(p)) * 2), legs: [[24 * sin(p), -20 * Math.max(0, cos(p))], [24 * sin(p + Math.PI), -20 * Math.max(0, cos(p + Math.PI))]], neck: 6 };
      });
    case 'attack':
    case 'basic':
      return F((i) => ({ neck: [5, 30, 45, 20, 5, 0][i] ?? 0, headX: [0, 3, 6, 3, 0, 0][i] ?? 0, jaw: [0, 1, 3, 1, 0, 0][i] ?? 0, wing: 0,
        fx: i === 2 ? [{ type: 'sparks', at: 'head', n: 4, r: 5, color: glowFx, seed: 50 }] : undefined }));
    case 'heavy':
      return F((i) => ({
        neck: [-10, -30, -40, 40, 50, 10][i] ?? 0, bob: [0, -4, -6, 4, 5, 2][i] ?? 0, wing: [40, 60, 60, 0, -10, 0][i] ?? 0,
        tint: i < 2 ? '#ff3a3a' : undefined,
        fx: i === 4 ? [{ type: 'ring', at: 'hip', r: 16, ry: 6, color: glowFx, th: 1 }] : undefined,
      }));
    case 'special':
      return F((i) => ({
        neck: [10, 15, 20, 20, 15, 10][i] ?? 0, jaw: [2, 4, 4, 4, 3, 2][i] ?? 0, wing: 20,
        fx: i >= 2 && i <= 4 ? [
          { type: 'beam', at: 'head', angle: -4, len: 46, color: glowFx, th: 3 },
          { type: 'beam', at: 'head', angle: 6, len: 40, color: spec.breath2 || '#ffd27a', th: 2 },
        ] : undefined,
      }));
    case 'aoe':
      return F((i) => ({
        wing: [60, 70, 80, 80, 70, 60][i], neck: 6, bob: -2,
        fx: i >= 2 ? [{ type: 'ring', at: 'chest', r: [0, 0, 6, 12, 18, 24][i], ry: [0, 0, 3, 6, 9, 11][i], color: glowFx, th: 1 }] : undefined,
      }));
    case 'hit':
      return F((i) => ({ rot: i === 0 ? -8 : -4, neck: -10, flash: i === 0 }));
    case 'phase':
      return F((i) => ({
        jaw: [3, 5, 3, 5][i], wing: [40, 20, 40, 20][i], flash: i % 2 === 1, eyes: 'open',
        fx: [{ type: 'ring', at: 'chest', r: 10 + i * 4, ry: 8 + i * 2, color: glowFx, th: 1 }],
      }));
    case 'defeat':
      return F((i) => ({ rot: [0, -15, -35, -60, -80, -90][i], wing: [-10, -30, -50, -60, -60, -60][i], eyes: 'closed', bob: [0, 2, 4, 6, 8, 10][i] }));
    default:
      throw new Error(`Unknown dragon animation ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Floating set (eyes, wisps, robed overlords).
// ---------------------------------------------------------------------------
export function floatAnim(name, n, spec) {
  const glowFx = spec.glowFx || spec.glow || '#ffe27a';
  const F = (fn) => frames(n, (i) => fn(i, n));
  switch (name) {
    case 'idle':
      return F((i, n) => ({ bob: Math.round(sin((P2 * i) / n) * 2), sway: 2 * sin((P2 * i) / n), wave: (P2 * i) / n, eyes: 'open' }));
    case 'move':
    case 'walk':
      return F((i, n) => ({ bob: Math.round(sin((P2 * i) / n) * 2), sway: 3 * sin((P2 * i) / n), wave: (2 * P2 * i) / n }));
    case 'attack':
    case 'basic':
      return F((i) => ({ lookX: [0, 1, 2, 1, 0, 0][i] ?? 0, eyeY: [0, 0, 1, 0, 0, 0][i] ?? 0, wave: i, fx: i === 2 ? [{ type: 'sparks', at: 'chest', n: 5, r: 8, color: glowFx, seed: 60 }] : undefined }));
    case 'heavy':
      return F((i) => ({ wave: i, fx: i >= 2 ? [{ type: 'ring', at: 'chest', r: [0, 0, 8, 14, 20, 24][i], ry: [0, 0, 8, 14, 20, 24][i], color: glowFx, th: 1 }] : undefined, tint: i < 2 ? '#ff3a3a' : undefined }));
    case 'special':
      return F((i) => ({ eyeY: [0, -1, -1, 0, 0][i] ?? 0, wave: i, fx: i >= 1 ? [{ type: 'ring', at: 'chest', r: 4 + i * 3, ry: 2 + i * 2, color: glowFx, th: 1 }, { type: 'sparks', at: 'chest', n: 4, r: 10, color: glowFx, seed: 70 + i }] : undefined }));
    case 'aoe':
      return F((i) => ({ wave: i, bob: [0, -2, -3, 0, 1, 0][i] ?? 0, fx: i >= 2 ? [{ type: 'ring', at: 'hip', r: [0, 0, 10, 16, 22, 28][i], ry: [0, 0, 4, 6, 8, 10][i], color: glowFx, th: 1 }] : undefined }));
    case 'hit':
      return F((i) => ({ flash: i === 0, rot: i === 0 ? 8 : -6, wave: i }));
    case 'phase':
      return F((i) => ({ flash: i % 2 === 1, eyes: 'glow', wave: i, fx: [{ type: 'ring', at: 'chest', r: 10 + i * 4, ry: 10 + i * 4, color: glowFx, th: 1 }] }));
    case 'defeat':
      return F((i) => ({ rot: [0, 60, 120, 180, 240, 300][i], bob: [0, 2, 4, 6, 8, 10][i], eyes: 'closed', wave: i }));
    default:
      throw new Error(`Unknown floating animation ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Tree set (forest guardian).
// ---------------------------------------------------------------------------
export function treeAnim(name, n, spec) {
  const glowFx = spec.glowFx || spec.glow || '#ffd34d';
  const F = (fn) => frames(n, (i) => fn(i, n));
  const arms = (a, b) => [a, b];
  switch (name) {
    case 'idle':
      return F((i, n) => ({ bob: Math.round(sin((P2 * i) / n)), arms: arms([-15 + 3 * sin((P2 * i) / n), 10], [15 - 3 * sin((P2 * i) / n), 10]) }));
    case 'move':
    case 'walk':
      return F((i, n) => {
        const p = (P2 * i) / n;
        return { bob: -Math.round(Math.abs(sin(p)) * 2), rootL: 4 * sin(p), rootR: -4 * sin(p), arms: arms([-10, 0], [10, 0]) };
      });
    case 'attack':
    case 'basic':
      return F((i) => ({ arms: arms([[-60, 0], [-20, 10], [40, 20], [30, 10], [-10, 0]][i] ?? [0, 0], [[40, 0], [70, 10], [60, 20], [30, 10], [10, 0]][i] ?? [0, 0]), lean: 0, rot: i === 2 ? 2 : 0 }));
    case 'heavy':
      return F((i) => ({
        bob: [0, -4, -8, 6, 4, 0][i] ?? 0, arms: arms([[-150, 0], [-160, 0], [70, 10], [80, 10], [80, 10], [30, 0]][i], [[150, 0], [160, 0], [80, 10], [90, 10], [80, 10], [30, 0]][i]),
        tint: i < 2 ? '#ff3a3a' : undefined,
        fx: i === 4 ? [{ type: 'ring', at: 'hip', r: 18, ry: 6, color: glowFx, th: 1 }] : undefined,
      }));
    case 'special':
      return F((i) => ({ arms: arms([150 - i * 4, 0], [-150 + i * 4, 0]), jaw: 0,
        fx: i >= 2 ? [{ type: 'beam', at: 'hand', angle: 25, len: 20, color: glowFx, th: 2 }, { type: 'beam', at: 'handB', angle: 65, len: 20, color: glowFx, th: 2 }] : undefined }));
    case 'aoe':
      return F((i) => ({
        rootL: [0, -3, -6, -3, 0, 0][i] ?? 0, rootR: [0, -3, -6, -3, 0, 0][i] ?? 0, bob: [0, -1, -2, 0, 0, 0][i] ?? 0,
        fx: i >= 2 ? [{ type: 'ring', at: 'hip', r: [0, 0, 10, 18, 26, 32][i], ry: [0, 0, 3, 5, 7, 8][i], color: glowFx, th: 1 }] : undefined,
      }));
    case 'hit':
      return F((i) => ({ rot: i === 0 ? 3 : -2, flash: i === 0, arms: arms([-30, 10], [30, 10]) }));
    case 'phase':
      return F((i) => ({ flash: i % 2 === 1, eyes: 'glow', crown: [0, 2, 4, 2][i], arms: arms([-40, 0], [40, 0]), fx: [{ type: 'ring', at: 'chest', r: 12 + i * 5, ry: 8 + i * 3, color: glowFx, th: 1 }] }));
    case 'defeat':
      return F((i) => ({ rot: [0, -20, -45, -70, -85, -90][i], bob: [0, 2, 4, 6, 8, 10][i], eyes: 'closed', arms: arms([-30 + i * 10, 0], [30 - i * 10, 0]) }));
    default:
      throw new Error(`Unknown tree animation ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Tentacle set (kraken).
// ---------------------------------------------------------------------------
export function tentAnim(name, n, spec) {
  const glowFx = spec.glowFx || spec.glow || '#ffe27a';
  const F = (fn) => frames(n, (i) => fn(i, n));
  switch (name) {
    case 'idle':
      return F((i, n) => ({ wave: (P2 * i) / n, lift: [0, 1, 0, -1][i] ?? 0 }));
    case 'move':
    case 'walk':
      return F((i, n) => ({ wave: (2 * P2 * i) / n, lift: Math.round(2 * sin((P2 * i) / n)) }));
    case 'attack':
    case 'basic':
      return F((i) => ({ wave: [0, 2, 4, 5, 6, 6][i] ?? 0, lift: [0, -2, -4, 0, 2, 0][i] ?? 0, fx: i === 2 ? [{ type: 'sparks', at: 'hip', n: 5, r: 10, color: spec.sucker || '#9ad8ff', seed: 80 }] : undefined }));
    case 'heavy':
      return F((i) => ({ wave: i * 2, lift: [0, 4, 8, -4, -8, 0][i], tint: i < 2 ? '#ff3a3a' : undefined, fx: i >= 3 ? [{ type: 'ring', at: 'hip', r: 12 + i * 3, ry: 4 + i, color: glowFx, th: 1 }] : undefined }));
    case 'special':
      return F((i) => ({ wave: i, fx: i >= 1 ? [{ type: 'disc', at: 'hip', dy: 6, r: 2 + i * 2, color: spec.ink || '#1a1030' }, { type: 'sparks', at: 'hip', n: 5, r: 14, color: '#1a1030', seed: 90 + i }] : undefined }));
    case 'aoe':
      return F((i) => ({ wave: i * 2, lift: [0, -1, -2, 0, 1, 0][i], fx: i >= 2 ? [{ type: 'ring', at: 'hip', r: [0, 0, 8, 14, 20, 26][i], ry: [0, 0, 3, 5, 7, 9][i], color: '#9ad8ff', th: 1 }] : undefined }));
    case 'hit':
      return F((i) => ({ flash: i === 0, wave: i, lift: -2 + i * 2 }));
    case 'phase':
      return F((i) => ({ flash: i % 2 === 1, eyes: 'glow', wave: i * 2, fx: [{ type: 'ring', at: 'hip', r: 14 + i * 4, ry: 4 + i, color: glowFx, th: 1 }] }));
    case 'defeat':
      return F((i) => ({ rot: [0, -15, -35, -60, -80, -90][i], lift: [0, 2, 4, 6, 8, 10][i], eyes: 'closed', wave: i }));
    default:
      throw new Error(`Unknown tentacle animation ${name}`);
  }
}

// Picks the right animation generator for a spec.
export function animFor(spec, name, n, kind) {
  if (spec.rig === 'humanoid') {
    if (kind === 'mob' && name === 'special') return humanoidSpecial(n, spec);
    if (kind === 'hero' && name === 'attack') return humanoidAnim('hero_attack', n, spec);
    if (kind === 'mob' && name === 'defeat') return humanoidAnim('defeat', n, spec);
    if (kind === 'mob' && name === 'move') return humanoidAnim('move', n, spec);
    if (kind === 'mob' && name === 'attack') return humanoidAnim('attack', n, spec);
    return humanoidAnim(name, n, spec);
  }
  if (spec.rig === 'quadruped') return quadAnim(name, n, spec);
  if (spec.rig === 'dragon') return dragonAnim(name, n, spec);
  if (spec.rig === 'floating') return floatAnim(name, n, spec);
  if (spec.rig === 'tree') return treeAnim(name, n, spec);
  if (spec.rig === 'tentacle') return tentAnim(name, n, spec);
  throw new Error(`No animations for rig ${spec.rig}`);
}

// ---------------------------------------------------------------------------
// HERO SPECS (48x48 frames)
// ---------------------------------------------------------------------------
const H = (o) => ({ rig: 'humanoid', s: 1.1, frame: [48, 48], cx: 24, baseY: 44, stance: 3, reach: 20, ...o });

export const HERO_SPECS = {
  aiden: H({
    head: 'helm', torso: 'plate', legs: 'greaves', cape: true, weapon: 'steel', offhand: 'kite_shield',
    colors: { skin: '#f2c29b', armor: '#9fb3c8', cloth: '#3a4a6a', boot: '#4a3322', cape: '#2e5fb5', trim: '#e7c04a', glow: '#bfe0ff', blade: '#e4edf6', guard: '#c9a24a', grip: '#6b4422', shield: '#3f6fb0', shieldTrim: '#f1d25a', plume: '#e7c04a' },
    trail: '#dff0ff', glowFx: '#bfe0ff',
  }),
  luna: H({
    head: 'ponytail', torso: 'leather', legs: 'boots', weapon: 'bow', cape: false,
    colors: { skin: '#f3c7a8', hair: '#d8e6ff', leather: '#3b5b4a', leatherD: '#22372c', cloth: '#2c3a52', boot: '#2b2030', grip: '#8a6a3a', string: '#f0f0f0', glow: '#bcd6ff', armor: '#3b5b4a' },
    trail: '#cfe3ff', glowFx: '#bcd6ff', reach: 16,
    extra: (p, ctx) => { // crescent moon emblem
      const b = ctx.pl([3, -6]);
      p.set(b[0], b[1], ctx.c.glow); p.set(b[0] + 1, b[1] - 1, ctx.c.glow); p.set(b[0] + 1, b[1] + 1, ctx.c.glow);
    },
  }),
  ronan: H({
    head: 'mane', torso: 'bare', legs: 'boots', armsStyle: 'bare', weapon: 'axe', weaponBack: 'axe', cape: false,
    colors: { skin: '#e9b58c', hair: '#6b2a1a', armor: '#8a6a4a', cloth: '#3c2a20', boot: '#2a1c14', glow: '#ff6b4a', grip: '#5b3a22', blade: '#c9d3dc', trim: '#b0302a', claw: '#c9d3dc' },
    trail: '#ffb0a0', glowFx: '#ff6b4a', reach: 22, idleAim: -60, eyes: 'open',
    extra: (p, ctx) => {
      // Scars and fur pauldrons.
      const a = ctx.pl([-3, -6]); const b = ctx.pl([2, -4]);
      p.line(a[0], a[1], b[0], b[1], darken(ctx.c.skin, 0.25), 1);
      p.disc(ctx.Hp[0] - 1, ctx.Hp[1] + 4, 4, 2, ctx.c.skin);
      void ctx.c;
    },
  }),
  mira: H({
    head: 'hat_wide', torso: 'robe', legs: 'robe', weapon: 'staff', offhand: 'orb', cape: false, hair: null,
    colors: { skin: '#f5cfb0', hair: '#ff7a3d', cloth: '#b33a2a', hat: '#5a1f3a', armor: '#b33a2a', trim: '#ffb347', glow: '#ff8a3d', glowDark: '#a83a1a', grip: '#5b3a22', crown: '#ffb347' },
    trail: '#ffc08a', glowFx: '#ff8a3d', robeLen: 13, reach: 18, hunch: 0,
  }),
  kael: H({
    head: 'shadow_hood', torso: 'shadow', legs: 'shadow', cape: true, weapon: 'dagger', weaponBack: 'dagger', stance: 4,
    colors: { skin: '#d8b9a2', cloth: '#14101e', armor: '#2a2238', boot: '#120c18', cape: '#1a1426', glow: '#c96bff', eye: '#120a18', blade: '#c8b8e8', grip: '#2a1a30', hair: '#1a1426' },
    trail: '#d9a6ff', glowFx: '#c96bff', reach: 16, hunch: 6, idleAim: -40,
  }),
  bruno: H({
    head: 'helm', torso: 'plate', legs: 'greaves', weapon: 'hammer', offhand: 'tower_shield', cape: false, s: 1.2, chunky: true, stance: 2,
    colors: { skin: '#e7b28c', armor: '#7d8796', cloth: '#4a4f5a', boot: '#2a2420', trim: '#c9a04a', shield: '#8c6a3a', shieldTrim: '#e7d27a', metal: '#cfd6de', grip: '#4a3020', glow: '#ffe27a', plume: '#c9a04a' },
    trail: '#e8e0c0', glowFx: '#ffe27a', reach: 24,
  }),
  sylvie: H({
    head: 'leaves', torso: 'robe', legs: 'robe', weapon: 'staff', cape: true, robeLen: 12,
    colors: { skin: '#f0c8a8', hair: '#7a4a2a', cloth: '#3e7a3a', armor: '#3e7a3a', trim: '#a8e07a', cape: '#2e6a2e', glow: '#5ccc6a', glowDark: '#2a7a3a', grip: '#6b4422', leaf: '#3e9a4a', leafL: '#7fdc78', leatherD: '#4a3420' },
    trail: '#a8ffb0', glowFx: '#5ccc6a', reach: 18,
    extra: (p, ctx) => { // vines across torso
      const a = ctx.pl([-3, -9]); const b = ctx.pl([3, -1]);
      p.line(a[0], a[1], b[0], b[1], ctx.c.leaf, 1);
    },
  }),
  darius: H({
    head: 'dragon_helm', torso: 'dark', legs: 'greaves', cape: true, weapon: 'greatsword', stance: 3, s: 1.2,
    colors: { skin: '#9a8aa8', armor: '#2a2030', cloth: '#1d1826', boot: '#100a14', cape: '#4a1f5c', trim: '#d05cff', glow: '#d05cff', blade: '#6b5a8a', bladeHi: '#d8b0ff', guard: '#3a2a4a', grip: '#2a1a30', horn: '#2a1a30', eye: '#120a18' },
    trail: '#e5b8ff', glowFx: '#d05cff', reach: 24, eyes: 'glow',
  }),
  elian: H({
    head: 'hat_wide', torso: 'robe', legs: 'robe', weapon: 'rod', offhand: 'orb', cape: true, robeLen: 13,
    colors: { skin: '#f1cfb4', hair: '#d8f0ff', cloth: '#2c5a9a', hat: '#2c5a9a', armor: '#2c5a9a', trim: '#8fe8ff', cape: '#1e3f6e', glow: '#5ee0ff', glowDark: '#2a7aa0', grip: '#5b3a22' },
    trail: '#bff3ff', glowFx: '#5ee0ff', reach: 18,
  }),
  riven: H({
    head: 'dragon_helm', torso: 'scale', legs: 'greaves', cape: true, weapon: 'lance', s: 1.15,
    colors: { skin: '#e9bfa6', hair: '#7a1f2a', armor: '#b23a3a', cloth: '#7a1f2a', boot: '#2a1218', cape: '#7a1f2a', trim: '#e8dcc0', glow: '#ff9a3a', blade: '#ece2c8', bladeHi: '#ffffff', grip: '#4a2a2a', horn: '#e8dcc0', eye: '#120a18' },
    trail: '#ffd0a0', glowFx: '#ff9a3a', reach: 22,
    behind: (p, ctx) => { // small dragon wing fins behind the back
      const b = ctx.pl([-6, -8]);
      p.poly([b, [b[0] - 6, b[1] - 6], [b[0] - 4, b[1] + 4]], ctx.c.armor);
    },
  }),
};

// ---------------------------------------------------------------------------
// ENEMY SPECS (40x40 frames)
// ---------------------------------------------------------------------------
const E = (o) => ({ rig: 'humanoid', s: 0.9, frame: [40, 40], cx: 20, baseY: 36, stance: 3, reach: 14, ...o });

export const ENEMY_SPECS = {
  zombie: E({
    head: 'bald', torso: 'tunic', legs: 'boots', motion: 'shamble', hunch: 12, weapon: 'claws', armsStyle: 'bare', eyes: 'glow', s: 0.95,
    colors: { skin: '#7aa35a', hair: '#3a2a20', cloth: '#5b4a3a', boot: '#2a2030', leather: '#4a3a30', leatherD: '#2a2018', glow: '#ffe27a', claw: '#d8e0c8', trim: '#8a7a50' },
    trail: '#b8e0a0', glowFx: '#ffe27a', reach: 12, idleAim: -70,
    extra: (p, ctx) => { const a = ctx.pl([-2, -8]); p.set(a[0], a[1], '#3a4a2a'); },
  }),
  skeleton: E({
    head: 'skull', torso: 'ribs', legs: 'bare', weapon: 'sword', offhand: 'shield', s: 0.92,
    colors: { skin: '#ece4cc', bone: '#ece4cc', cloth: '#ece4cc', armor: '#ece4cc', boot: '#6a6050', shield: '#6b4a2a', shieldTrim: '#b89a4a', metal: '#cfd8e0', grip: '#5a4030', glow: '#ff5a5a', eye: '#1a1420', armsStyle: 'bare' },
    trail: '#f0f0f0', glowFx: '#ff5a5a', reach: 13, armsStyle: 'bare',
  }),
  bandit: E({
    head: 'bandana', torso: 'leather', legs: 'boots', weapon: 'scimitar', cape: false,
    colors: { skin: '#d9a878', hair: '#2a2a2a', leather: '#5a4030', leatherD: '#3a2818', cloth: '#4a3a2a', boot: '#2a2018', trim: '#b0302a', blade: '#c8d0d8', grip: '#5a3a20', glow: '#ffe27a' },
    trail: '#e0e8f0', glowFx: '#ffe27a', reach: 14,
  }),
  goblin: E({
    head: 'bald', torso: 'leather', legs: 'boots', weapon: 'dagger', s: 0.8, eyes: 'angry', motion: 'hop',
    colors: { skin: '#7fb35a', cloth: '#5a3a2a', leather: '#6a4a2a', leatherD: '#3e2a18', boot: '#2a2018', blade: '#a8b0b8', grip: '#4a3020', glow: '#ff5a3a', hair: '#3a2a20' },
    trail: '#d0ffd0', glowFx: '#ff5a3a', reach: 10,
    extra: (p, ctx) => { // big pointed ears
      const r = ctx.Hp; const hr = ctx.headR;
      p.poly([[r[0] - hr, r[1] - 1], [r[0] - hr - 5, r[1] - 3], [r[0] - hr, r[1] + 2]], ctx.c.skin);
      p.poly([[r[0] + hr * 0.2, r[1] - hr * 0.8], [r[0] + hr * 0.4 + 1, r[1] - hr - 3], [r[0] + hr * 0.7, r[1] - hr * 0.6]], ctx.c.skinD);
    },
  }),
  wolf: { rig: 'quadruped', s: 1.0, frame: [40, 40], cx: 20, baseY: 34, bodyLen: 18, bodyH: 9, legLen: 7, headR: 3.6, head: 'wolf', tail: 'bushy', glowEyes: true,
    colors: { body: '#6e6a78', bodyD: '#3f3b4a', belly: '#9a96a6', leg: '#55515f', glow: '#ffd34d', eye: '#120a18', claw: '#f2ead8', snout: '#55515f' }, trail: '#dcd8e8', glowFx: '#ffd34d' },
  dark_mage: E({
    head: 'cowl', torso: 'robe', legs: 'robe', weapon: 'staff', offhand: 'orb', robeLen: 12, eyes: 'glow',
    colors: { skin: '#b8a0c8', cloth: '#2a1f3d', armor: '#2a1f3d', trim: '#c26bff', glow: '#c26bff', glowDark: '#6a2a9a', grip: '#3a2a4a', cape: '#2a1f3d', eye: '#120a18' },
    trail: '#e0b0ff', glowFx: '#c26bff', reach: 16,
  }),
  ice_warrior: E({
    head: 'helm', torso: 'frost', legs: 'greaves', weapon: 'ice_spear', offhand: 'shield', eyes: 'glow', s: 1.0,
    colors: { skin: '#e6d2c0', armor: '#7fb0d8', cloth: '#3a5a7a', boot: '#2a3a4a', ice: '#e8f8ff', shield: '#5a86b0', shieldTrim: '#eaf7ff', blade: '#bfeaff', grip: '#3a4a5a', glow: '#bfeaff', metal: '#bfeaff' },
    trail: '#dff6ff', glowFx: '#bfeaff', reach: 20,
  }),
  ice_golem: E({
    head: 'helm', torso: 'bulk', legs: 'shadow', weapon: 'hammer', chunky: true, s: 1.15, eyes: 'glow', stance: 2,
    colors: { skin: '#9ad7f0', armor: '#9ad7f0', cloth: '#7fb0d8', armorD: '#4a86b0', boot: '#4a86b0', glow: '#e8fcff', metal: '#cfe8f5', grip: '#3a4a5a', eye: '#1a3a5a' },
    trail: '#e8fcff', glowFx: '#e8fcff', reach: 18, idleAim: -60,
    extra: (p, ctx) => { // crystal shards on shoulders
      const q = ctx.pl([-6, -14]);
      p.poly([[q[0], q[1]], [q[0] - 3, q[1] - 4], [q[0] + 2, q[1] - 3]], ctx.c.glow);
    },
  }),
  demon: E({
    head: 'horns', torso: 'dark', legs: 'bare', weapon: 'claws', hair: null, eyes: 'angry', armsStyle: 'bare',
    colors: { skin: '#c24a3a', hair: '#2a1a1a', horn: '#e0d0b0', armor: '#6a2222', cloth: '#6a2222', boot: '#3a1a1a', glow: '#ff7a3a', claw: '#f2d8b0', eye: '#120a18' },
    trail: '#ffb090', glowFx: '#ff7a3a', reach: 14,
    extra: (p, ctx) => { // tail
      const t = ctx.pl([-6, 6]);
      p.line(t[0], t[1], t[0] - 6, t[1] + 4, ctx.c.skin, 2);
      p.set(t[0] - 7, t[1] + 4, ctx.c.glow);
    },
  }),
  shadow_assassin: E({
    head: 'shadow_hood', torso: 'shadow', legs: 'shadow', cape: true, weapon: 'dagger', weaponBack: 'dagger', stance: 4, hunch: 6, eyes: 'glow', s: 0.95,
    colors: { skin: '#b8a0c8', cloth: '#14101e', armor: '#1d1628', boot: '#0a0712', cape: '#14101e', glow: '#c96bff', eye: '#120a18', blade: '#b0a0d0', grip: '#2a1a30' },
    trail: '#c9a0ff', glowFx: '#c96bff', reach: 13, idleAim: -40,
  }),
  sand_scorpion: { rig: 'quadruped', s: 1.1, frame: [40, 40], cx: 19, baseY: 34, bodyLen: 14, bodyH: 8, legLen: 6, headR: 3, head: 'scorpion', tail: 'stinger', tailUp: 6, stripes: true,
    colors: { body: '#c8893a', bodyD: '#8a5a22', belly: '#e0b070', leg: '#8a5a22', claw: '#d8c090', stinger: '#ff4a2a', glow: '#ffd34d', eye: '#120a18' }, trail: '#ffe0a0', glowFx: '#ffd34d' },
  abyssal_fishman: E({
    head: 'fin', torso: 'scale', legs: 'shadow', weapon: 'trident', eyes: 'glow', s: 0.95,
    colors: { skin: '#3ab0a0', armor: '#2a8fa8', cloth: '#2a6a7a', boot: '#1a3a4a', fin: '#2a8fa8', glow: '#ffe27a', blade: '#c8e0e8', grip: '#2a4a5a', eye: '#1a2a30' },
    trail: '#bff0ff', glowFx: '#ffe27a', reach: 16,
    extra: (p, ctx) => { // gills
      const g = ctx.pl([-2, -6]);
      p.line(g[0], g[1], g[0] - 2, g[1] + 2, ctx.c.glow, 1);
      p.line(g[0] - 1, g[1] + 1, g[0] - 3, g[1] + 3, ctx.c.glow, 1);
    },
  }),
  reef_crab: { rig: 'quadruped', s: 1.1, frame: [40, 40], cx: 20, baseY: 34, bodyLen: 14, bodyH: 7, legLen: 4, headR: 3, head: 'tyrant', tail: 'none', shell: true,
    colors: { body: '#d8603a', bodyD: '#9a3a22', belly: '#f0a070', leg: '#9a3a22', claw: '#f2a070', shell: '#e87a4a', glow: '#ffe27a', eye: '#120a18' }, trail: '#ffc0a0', glowFx: '#ffe27a' },
  dragon_whelp: { rig: 'dragon', s: 1.0, frame: [40, 40], cx: 20, baseY: 36, bodyLen: 13, bodyH: 8, legLen: 5, headR: 3, wingSpan: 18, flyHeight: 0, scales: false,
    colors: { body: '#3a9a6a', bodyD: '#22654a', wing: '#2a7a5a', wingD: '#1a4a36', belly: '#a8e0b0', horn: '#e8dcc0', glow: '#ffe27a', eye: '#120a18' }, trail: '#c0ffd0', glowFx: '#ffe27a', breath2: '#ffb040' },
  nightmare_eye: { rig: 'floating', s: 1.0, frame: [40, 40], cx: 20, baseY: 38, radius: 10, tailLen: 14, spikes: true, eyes: 1, floatH: 2,
    colors: { body: '#6a2a7a', bodyD: '#3a1a4a', glow: '#ff5ad6', eye: '#120a18' }, trail: '#ffb0f0', glowFx: '#ff5ad6' },
  nightmare_hound: { rig: 'quadruped', s: 1.05, frame: [40, 40], cx: 20, baseY: 34, bodyLen: 17, bodyH: 9, legLen: 7, headR: 3.4, head: 'wolf', tail: 'short', spikes: true, glowEyes: true,
    colors: { body: '#2a2038', bodyD: '#14101e', belly: '#3a2a50', leg: '#241c32', glow: '#ff5ad6', eye: '#120a18', claw: '#e0c0ff', snout: '#241c32' }, trail: '#ffb0f0', glowFx: '#ff5ad6' },
  celestial_sentinel: E({
    head: 'sentinel', torso: 'plate', legs: 'greaves', cape: true, weapon: 'spear', offhand: 'shield', s: 1.0, eyes: 'glow',
    colors: { skin: '#f0e6d0', armor: '#e6e0f0', cloth: '#d8d0e8', cape: '#f7f2ff', trim: '#ffe27a', boot: '#8a80a8', shield: '#f2ead0', shieldTrim: '#ffe27a', blade: '#fff3c0', glow: '#ffe27a', grip: '#c8b070', metal: '#ffe8a0' },
    trail: '#fff3c0', glowFx: '#ffe27a', reach: 18,
    behind: (p, ctx) => { // feathered wings
      const b = ctx.pl([-3, -10]);
      for (let k = 0; k < 3; k += 1) p.poly([[b[0], b[1] + k * 2], [b[0] - 9, b[1] - 6 + k * 2], [b[0] - 6, b[1] + 3 + k * 2]], ctx.c.cape);
    },
  }),
  star_wisp: { rig: 'floating', s: 0.95, frame: [40, 40], cx: 20, baseY: 38, radius: 8, tailLen: 10, spikes: true, eyes: 1, floatH: 3, robed: false,
    colors: { body: '#ffe9a0', bodyD: '#f0b050', glow: '#fff6c0', eye: '#7a4a10' }, trail: '#fff6c0', glowFx: '#fff6c0' },
};

// ---------------------------------------------------------------------------
// BOSS SPECS (96x96 frames)
// ---------------------------------------------------------------------------
const B = (o) => ({ rig: 'humanoid', s: 2.1, frame: [96, 96], cx: 48, baseY: 90, stance: 3, reach: 50, ...o });

export const BOSS_SPECS = {
  undead_warlord: B({
    head: 'bone_crown', torso: 'plate', legs: 'greaves', cape: true, weapon: 'greatsword', offhand: 'orb', s: 2.1, hunch: 4,
    colors: { skin: '#8fb06a', armor: '#4a4a58', cloth: '#2e2e3a', boot: '#1a1a22', cape: '#2a2030', trim: '#8fd45a', glow: '#8fd45a', glowDark: '#3a6a2a', blade: '#b8c0c8', bladeHi: '#f0f4f8', guard: '#3a3a48', grip: '#3a2a20', bone: '#e8e0c4', crown: '#d8c26a', eye: '#0a1a08' },
    trail: '#b8ffa0', glowFx: '#8fd45a', reach: 52, eyes: 'glow', idleAim: -70,
    extra: (p, ctx) => { // bone pauldrons
      for (const sx of [-1, 1]) { const q = ctx.pl([sx * 9, -20]); p.disc(q[0], q[1], 3, 3, ctx.c.bone); }
    },
  }),
  forest_guardian: { rig: 'tree', s: 2.2, frame: [96, 96], cx: 48, baseY: 90, trunkW: 28, trunkH: 44, armLen: 36, rootH: 8, eyes: 'glow',
    colors: { body: '#7a5a3a', bodyD: '#4a3420', leaf: '#3e9a4a', leafL: '#7fdc78', glow: '#ffd34d', eye: '#1a1008' }, trail: '#c8ffb0', glowFx: '#ffd34d',
    extra: (p, ctx) => { // moss & mushrooms
      for (let k = 0; k < 6; k += 1) p.set(ctx.cx - 12 + k * 5, ctx.top + 10 + (k % 2) * 8, ctx.c.leafL);
      p.disc(ctx.cx - 14, ctx.base - 14, 2, 2, 0xe0505aff);
    } },
  frost_dragon: { rig: 'dragon', s: 2.0, frame: [96, 96], cx: 48, baseY: 90, bodyLen: 26, bodyH: 14, legLen: 9, headR: 5, wingSpan: 30, scales: true, flyHeight: 0,
    colors: { body: '#bfe8ff', bodyD: '#6aa8d8', wing: '#8fd0ff', wingD: '#4a88c0', belly: '#eaf8ff', horn: '#e8f4ff', glow: '#7fd8ff', eye: '#0a2a4a' }, trail: '#dff6ff', glowFx: '#7fd8ff', breath2: '#e8ffff' },
  demon_king: B({
    head: 'demon', torso: 'dark', legs: 'greaves', weapon: 'greatsword', offhand: 'orb', winged: true, s: 2.2, hunch: 2,
    colors: { skin: '#b53a2a', hair: '#2a1a1a', horn: '#e8d8b0', armor: '#3a1a2a', cloth: '#2a1520', boot: '#1a0a12', trim: '#ff7a3a', glow: '#ff5a3c', glowDark: '#8a2a1a', blade: '#ff7a3a', bladeHi: '#ffe27a', guard: '#5a2a1a', grip: '#2a1a1a', cape: '#2a1520', eye: '#ffe27a' }, trail: '#ffc09a', glowFx: '#ff5a3c', reach: 52, eyes: 'glow',
    behind: (p, ctx) => { // large wings
      for (const sx of [-1]) {
        const b = ctx.pl([-4, -18]);
        p.poly([b, [b[0] - 26, b[1] - 24], [b[0] - 20, b[1] - 6], [b[0] - 24, b[1] + 6], [b[0] - 8, b[1] + 16]], ctx.c.armor);
        p.line(b[0], b[1], b[0] - 24, b[1] - 22, ctx.c.trim, 1);
        void sx;
      }
    },
  }),
  shadow_overlord: { rig: 'floating', s: 2.4, frame: [96, 96], cx: 48, baseY: 90, radius: 16, tailLen: 30, spikes: true, eyes: 2, floatH: 6, robed: true, eyeY: 0,
    colors: { body: '#2a1f3d', bodyD: '#120a1e', glow: '#9a6bff', eye: '#120a18', robe: '#1a1028' }, trail: '#c8b0ff', glowFx: '#9a6bff',
    extra: (p, ctx) => { // shadow tendrils
      for (let k = 0; k < 4; k += 1) {
        const a = ctx.r * (0.5 + k * 0.3);
        p.line(ctx.b[0] - a, ctx.b[1] + ctx.r * 0.2, ctx.b[0] - a - 8, ctx.b[1] + ctx.r * 1.5 + k * 2, ctx.c.glow, 1);
      }
    } },
  sand_tyrant: { rig: 'quadruped', s: 2.3, frame: [96, 96], cx: 46, baseY: 90, bodyLen: 26, bodyH: 16, legLen: 10, headR: 6, head: 'tyrant', tail: 'stinger', tailUp: 12, stripes: true,
    colors: { body: '#d8a050', bodyD: '#8a5a22', belly: '#f0c880', leg: '#a86a2a', claw: '#e8dcc0', stinger: '#ff5a2a', glow: '#ffd34d', eye: '#120a08', snout: '#a86a2a', shell: '#e8b060' }, trail: '#ffe0a0', glowFx: '#ffd34d', glowEyes: true },
  kraken_lord: { rig: 'tentacle', s: 2.3, frame: [96, 96], cx: 48, baseY: 90, mantleR: 16, arms: 8, ink: '#1a1030', sucker: '#9ad8ff',
    colors: { body: '#2a5a9a', bodyD: '#1a3a6a', sucker: '#9ad8ff', glow: '#ffe27a', eye: '#0a1a2a', ink: '#1a1030' }, trail: '#9ad8ff', glowFx: '#ffe27a' },
  elder_dragon: { rig: 'dragon', s: 2.2, frame: [96, 96], cx: 48, baseY: 90, bodyLen: 26, bodyH: 15, legLen: 8, headR: 5, wingSpan: 30, scales: true,
    colors: { body: '#d05a2a', bodyD: '#8a2a1a', wing: '#e07a3a', wingD: '#9a3a1a', belly: '#ffc070', horn: '#ffe0a0', glow: '#ffe27a', eye: '#2a0a00' }, trail: '#ffe0a0', glowFx: '#ffe27a', breath2: '#ff8a3a' },
  nightmare_emperor: { rig: 'floating', s: 2.4, frame: [96, 96], cx: 48, baseY: 90, radius: 16, tailLen: 26, spikes: true, eyes: 3, floatH: 6, robed: true,
    colors: { body: '#3a1a4a', bodyD: '#1a0a2a', glow: '#e05cff', eye: '#120a18', robe: '#24102e' }, trail: '#f0b0ff', glowFx: '#e05cff',
    extra: (p, ctx) => { // crown spikes
      for (let k = 0; k < 5; k += 1) {
        const x = ctx.b[0] - 12 + k * 6;
        p.poly([[x - 2, ctx.b[1] - ctx.r + 2], [x, ctx.b[1] - ctx.r - 6], [x + 2, ctx.b[1] - ctx.r + 2]], ctx.c.glow);
      }
    } },
  celestial_overlord: B({
    head: 'sentinel', torso: 'plate', legs: 'greaves', cape: true, weapon: 'greatsword', offhand: 'shield', winged: true, s: 2.2,
    colors: { skin: '#f6e6c8', armor: '#f2ecd8', cloth: '#f0ead0', cape: '#fff7d6', trim: '#ffe27a', boot: '#c8b890', shield: '#f2ecd8', shieldTrim: '#ffe27a', blade: '#fff6c0', bladeHi: '#ffffff', guard: '#ffe27a', grip: '#c8b070', glow: '#ffe27a', glowDark: '#c8a030', metal: '#fff6c0', eye: '#2a2008' },
    trail: '#fff6c0', glowFx: '#ffe27a', reach: 52,
    behind: (p, ctx) => { // grand wings
      const b = ctx.pl([-4, -16]);
      for (let k = 0; k < 3; k += 1) p.poly([b, [b[0] - 26, b[1] - 20 + k * 6], [b[0] - 22, b[1] + 2 + k * 6], [b[0] - 8, b[1] + 12 + k * 3]], k % 2 ? ctx.c.cape : ctx.c.armor);
    },
  }),
};

// Build a complete manifest of sheets to render.
export function buildSheetList() {
  const list = [];
  for (const id of Object.keys(HEROES)) list.push({ kind: 'hero', id, spec: HERO_SPECS[id], anims: HERO_ANIMS, file: `sprites/heroes/${id}.png` });
  for (const id of Object.keys(ENEMIES)) list.push({ kind: 'mob', id, spec: ENEMY_SPECS[id], anims: MOB_ANIMS, file: `sprites/enemies/${id}.png` });
  for (const id of Object.keys(BOSSES)) list.push({ kind: 'boss', id, spec: BOSS_SPECS[id], anims: BOSS_ANIMS, file: `sprites/bosses/${id}.png` });
  return list;
}
