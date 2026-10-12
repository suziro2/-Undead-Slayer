// Pure battle rules: spawn planning, damage, enemy/boss/companion decisions.
// No Phaser imports, so these functions are covered by node:test.
import { ENEMIES, BOSSES } from '../../shared/data.js';
import { parseMobKey, enemyScale } from '../../shared/rules.js';

export const MAP_W = 1600;
export const FOOT_MIN = 236;
export const FOOT_MAX = 300;
export const AGGRO_X = 340;       // enemies wake when the hero is this close horizontally
export const MELEE_DY = 24;       // vertical tolerance for melee hits

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Damage with +-10% variance and a flat defence reduction. Never below 1.
export function damage(atk, def, mult = 1, rng = Math.random) {
  const raw = atk * mult * (0.9 + 0.2 * rng()) - def * 0.5;
  return Math.max(1, Math.round(raw));
}

// Enemy stats for a given scale (from shared/rules enemyScale) and elite flag.
export function enemyStats(type, scale) {
  const e = ENEMIES[type];
  if (!e) throw new Error(`Unknown enemy ${type}`);
  return {
    type,
    kind: e.kind,
    rig: e.rig,
    maxHp: Math.round(e.hp * scale.hpMult),
    atk: Math.round(e.atk * scale.atkMult),
    def: e.def,
    speed: e.speed,
    aggro: e.aggro,
    range: e.range,
    cooldown: e.cooldown,
    coins: Math.round(e.coins * scale.coinMult),
    xp: Math.round(e.xp * scale.xpMult),
    size: e.size,
    special: e.special,
    chunky: !!e.chunky,
    winged: !!e.winged,
  };
}

// Builds the list of enemies for a mob/elite level, spread across the right side of the map.
// composition.mobs: { type | 'elite:type': count }. Returns spawn records with x positions.
export function planMobSpawns(composition, chapterId, level, rng = Math.random) {
  const list = [];
  for (const [key, count] of Object.entries(composition.mobs || {})) {
    const { type, elite } = parseMobKey(key);
    for (let i = 0; i < count; i += 1) list.push({ key, type, elite });
  }
  // Shuffle deterministically per call so waves feel varied but reproducible inside a battle.
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const n = Math.max(1, list.length);
  const span = MAP_W - 520;
  return list.map((item, i) => {
    const scale = enemyScale(chapterId, level, item.elite);
    const x = 460 + ((i + 0.5) / n) * span + (rng() - 0.5) * 30;
    const y = FOOT_MIN + 12 + rng() * (FOOT_MAX - FOOT_MIN - 24);
    return { ...enemyStats(item.type, scale), key: item.key, elite: item.elite, x: Math.round(x), y: Math.round(y) };
  });
}

// Boss stats scaled by chapter. HP grows 25% per chapter; attack 8% per chapter.
export function bossStats(bossId, chapterId) {
  const b = BOSSES[bossId];
  if (!b) throw new Error(`Unknown boss ${bossId}`);
  return {
    id: bossId,
    name: b.name,
    rig: b.rig,
    maxHp: Math.round(b.hp * (1 + 0.25 * (chapterId - 1))),
    atk: Math.round(b.atk * (1 + 0.08 * (chapterId - 1))),
    def: b.def,
    speed: b.speed,
    size: b.size,
    phases: b.phases,
    summons: b.summons,
    attacks: b.attacks,
  };
}

// 0 = healthy, 1 = below 66%, 2 = below 33%.
export function bossPhase(hpRatio) {
  if (hpRatio <= 0.33) return 2;
  if (hpRatio <= 0.66) return 1;
  return 0;
}

// Cooldown multiplier per phase: later phases attack more often.
export const PHASE_CD = [1, 0.8, 0.62];
export const PHASE_SPEED = [1, 1.12, 1.28];
export const BOSS_CD = { basic: 1.3, heavy: 4.2, special: 3.2, aoe: 6.5 };

// Enemy AI step. Returns a decision for this frame. Mutates e.cd/e.spCd timers only.
// ctx: { px, py, dodging } ; returns { vx, vy, facing, melee, special, moving }
export function enemyDecision(e, ctx, dt) {
  e.cd = Math.max(0, (e.cd || 0) - dt);
  e.spCd = Math.max(0, (e.spCd || 0) - dt);
  const dx = ctx.px - e.x;
  const dy = ctx.py - e.y;
  const facing = dx >= 0 ? 1 : -1;
  if (!e.awake) {
    if (Math.abs(dx) < AGGRO_X && Math.abs(dy) < 120) e.awake = true;
    else return { vx: 0, vy: 0, facing: e.facing || facing, melee: false, special: null, moving: false };
  }
  const idealDist = e.kind === 'ranged' ? e.range * 0.7 : Math.max(10, e.range * 0.7);
  let vx = 0;
  let vy = 0;
  const speed = e.speed * (e.kind === 'charger' ? 1.15 : 1);
  if (Math.abs(dx) > idealDist + 4) vx = facing * speed;
  else if (e.kind === 'ranged' && Math.abs(dx) < idealDist * 0.5) vx = -facing * speed * 0.6;
  if (e.kind === 'flyer') {
    const hover = ctx.py - 70;
    vy = clamp(hover - e.y, -speed * 0.5, speed * 0.5);
  } else if (Math.abs(dy) > 6) {
    vy = clamp(dy, -speed * 0.5, speed * 0.5);
  }
  e.y = clamp(e.y + vy * dt, FOOT_MIN, FOOT_MAX);
  let melee = false;
  let special = null;
  if (e.kind !== 'ranged' && e.cd <= 0 && Math.abs(dx) <= e.range + 6 && Math.abs(dy) <= MELEE_DY && !ctx.dodging) {
    melee = true;
    e.cd = e.cooldown;
  }
  if (e.kind === 'ranged' && e.cd <= 0 && Math.abs(dx) <= e.range && Math.abs(dy) < 40) {
    melee = true; // ranged units use the basic attack as a shot
    e.cd = e.cooldown;
  }
  if (e.special && e.spCd <= 0 && Math.abs(dx) > 40 && Math.abs(dx) < 260 && !melee) {
    special = e.special.type;
    e.spCd = e.special.cooldown;
  }
  return { vx, vy, facing, melee, special, moving: vx !== 0 || vy !== 0 };
}

// Boss decision. Returns { vx, facing, attack: 'basic'|'heavy'|'special'|'aoe'|null, moving }.
export function bossDecision(b, ctx, dt) {
  for (const k of Object.keys(BOSS_CD)) b.cds = b.cds || {};
  b.cds = b.cds || {};
  for (const k of Object.keys(BOSS_CD)) b.cds[k] = Math.max(0, (b.cds[k] || 0) - dt);
  const dx = ctx.px - b.x;
  const facing = dx >= 0 ? 1 : -1;
  if (!b.active) {
    if (Math.abs(dx) < 560) b.active = true;
    else return { vx: 0, facing: b.facing || -1, attack: null, moving: false };
  }
  if (b.busy) return { vx: 0, facing, attack: null, moving: false };
  const mult = PHASE_CD[b.phase] ?? 1;
  const dist = Math.abs(dx);
  const range = b.attacks.basic.range;
  let attack = null;
  if (b.cds.aoe <= 0 && dist < 300) attack = 'aoe';
  else if (b.cds.heavy <= 0 && dist <= b.attacks.heavy.range + 40) attack = 'heavy';
  else if (b.cds.basic <= 0 && dist <= range + 10) attack = 'basic';
  else if (b.cds.special <= 0 && dist >= 90) attack = 'special';
  if (attack) {
    b.cds[attack] = BOSS_CD[attack] * mult;
    // Shared short pause so the boss never chains attacks without a window to dodge.
    b.cds.basic = Math.max(b.cds.basic, 0.5);
    return { vx: 0, facing, attack, moving: false };
  }
  const want = attack === null && dist > range * 0.8 ? facing * b.speed * PHASE_SPEED[b.phase] : 0;
  return { vx: want, facing, attack: null, moving: want !== 0 };
}

// Companion (AI hero) decision. c: { x, speed, range, mana, maxMana, hp, maxHp }.
// ctx: { px, facing, slot, enemies: [{x,y}] } returns { vx, facing, attack, special }.
export function companionDecision(c, ctx, dt) {
  c.cd = Math.max(0, (c.cd || 0) - dt);
  const followX = ctx.px - ctx.facing * (50 + ctx.slot * 34);
  let target = null;
  let best = 260;
  for (const e of ctx.enemies) {
    const d = Math.abs(e.x - c.x);
    if (d < best && Math.abs(e.y - c.y) < 60) { best = d; target = e; }
  }
  if (!target) {
    const dx = followX - c.x;
    const vx = Math.abs(dx) > 14 ? Math.sign(dx) * c.speed : 0;
    return { vx, facing: vx ? Math.sign(vx) : c.facing || ctx.facing, attack: false, special: false };
  }
  const dx = target.x - c.x;
  const facing = dx >= 0 ? 1 : -1;
  const want = Math.max(8, c.range * 0.7);
  const vx = Math.abs(dx) > want ? facing * c.speed : 0;
  let attack = false;
  if (c.cd <= 0 && Math.abs(dx) <= c.range + 6) {
    attack = true;
    c.cd = 0.9;
  }
  const special = c.mana >= c.specialCost && Math.abs(dx) <= c.range + 40 && c.specialReady;
  return { vx, facing, attack, special: !!special };
}

// Sum of XP and coins shown as popups; the authoritative values come from the server.
export function killRewardPreview(e) {
  return { coins: e.coins, xp: e.xp };
}
