// Pure game rules shared by client and server: unlock logic, level composition,
// scaling, XP curves and hero stat calculation. No DOM or Node-specific APIs.
import {
  CHAPTERS, ENEMIES, BOSSES, HEROES, UPGRADE, ALLOC_POINT, ASCEND,
  HERO_MAX_LEVEL, PLAYER_MAX_LEVEL, BOSS_LEVEL, LEVELS_PER_CHAPTER, MAX_TEAM,
} from './data.js';

export const levelKey = (chapter, level) => `${chapter}-${level}`;
export const chapterById = (id) => CHAPTERS.find((c) => c.id === Number(id)) || null;

// Keys are "chapter-level" strings. completed: Set or array of keys.
export function isLevelUnlocked(completed, chapter, level) {
  const done = completed instanceof Set ? completed : new Set(completed);
  if (chapter < 1 || chapter > CHAPTERS.length) return false;
  if (level < 1 || level > LEVELS_PER_CHAPTER) return false;
  if (level > 1) return done.has(levelKey(chapter, level - 1));
  if (chapter === 1) return true;
  return done.has(levelKey(chapter - 1, BOSS_LEVEL));
}

export function isChapterCompleted(completed, chapter) {
  const done = completed instanceof Set ? completed : new Set(completed);
  return done.has(levelKey(chapter, BOSS_LEVEL));
}

export function countCompletedChapters(completed) {
  return CHAPTERS.filter((c) => isChapterCompleted(completed, c.id)).length;
}

// Composition of a level: which enemy types spawn and how many.
// Mob keys use "type" for regular enemies and "elite:type" for elite enemies.
export function levelComposition(chapterId, level) {
  const chapter = chapterById(chapterId);
  if (!chapter) throw new Error('Unknown chapter');
  const roster = chapter.roster;
  const mobs = {};
  const add = (key, n) => { mobs[key] = (mobs[key] || 0) + n; };
  if (level >= 1 && level <= 3) {
    const total = 7 + 2 * level + Math.floor(chapter.id / 3);
    for (let i = 0; i < total; i += 1) add(roster[i % roster.length], 1);
    return { chapter: chapter.id, level, kind: 'mobs', mobs, boss: null, maxKills: total, elites: 0 };
  }
  if (level === 4) {
    const regular = 8 + Math.floor(chapter.id / 3);
    const elites = 3;
    for (let i = 0; i < regular; i += 1) add(roster[i % roster.length], 1);
    add(`elite:${chapter.elite}`, elites);
    return { chapter: chapter.id, level, kind: 'elite', mobs, boss: null, maxKills: regular + elites, elites };
  }
  if (level === BOSS_LEVEL) {
    const boss = BOSSES[chapter.boss];
    return { chapter: chapter.id, level, kind: 'boss', mobs: {}, boss: boss.id, maxKills: 30, elites: 0, minions: boss.summons };
  }
  throw new Error('Unknown level');
}

// Splits a mob key into { type, elite }.
export function parseMobKey(key) {
  if (key.startsWith('elite:')) return { type: key.slice(6), elite: true };
  return { type: key, elite: false };
}

// Validates a kill report against a level composition.
// Returns { ok: true, kills } (normalized, only positive counts) or { ok: false, error }.
export function validateKills(chapterId, level, kills) {
  if (!kills || typeof kills !== 'object' || Array.isArray(kills)) return { ok: false, error: 'Invalid kill report' };
  const comp = levelComposition(chapterId, level);
  const chapter = chapterById(chapterId);
  const normalized = {};
  let total = 0;
  for (const [key, rawCount] of Object.entries(kills)) {
    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 0) return { ok: false, error: 'Invalid kill count' };
    if (count === 0) continue;
    const { type, elite } = parseMobKey(key);
    if (!ENEMIES[type]) return { ok: false, error: 'Unknown enemy type' };
    if (comp.kind === 'boss') {
      const allowed = new Set([...chapter.roster, ...(comp.minions || [])]);
      if (elite || !allowed.has(type)) return { ok: false, error: 'Enemy not in this level' };
    } else {
      const expected = comp.mobs[key] || 0;
      if (count > expected) return { ok: false, error: 'Too many kills for this enemy' };
    }
    normalized[key] = count;
    total += count;
  }
  if (total > comp.maxKills) return { ok: false, error: 'Kill count exceeds level size' };
  return { ok: true, kills: normalized, total };
}

// Scaling for regular and elite mobs.
export function enemyScale(chapterId, level, elite = false) {
  const c = chapterId - 1;
  const l = level - 1;
  return {
    hpMult: (1 + 0.3 * c) * (1 + 0.05 * l) * (elite ? 2.4 : 1),
    atkMult: (1 + 0.08 * c) * (1 + 0.03 * l) * (elite ? 1.35 : 1),
    coinMult: (1 + 0.2 * c) * (elite ? 2.5 : 1),
    xpMult: (1 + 0.25 * c) * (elite ? 2.5 : 1),
  };
}

// Reward values before random drops (coins, xp, crystals). `firstClear` controls the one-time clear bonus.
export function levelRewards(chapterId, level, kills, { firstClear = false, bossDefeated = false } = {}) {
  let coins = 0;
  let xp = 0;
  for (const [key, count] of Object.entries(kills || {})) {
    const { type, elite } = parseMobKey(key);
    const e = ENEMIES[type];
    if (!e) continue;
    const s = enemyScale(chapterId, level, elite);
    coins += Math.round(e.coins * s.coinMult) * count;
    xp += Math.round(e.xp * s.xpMult) * count;
  }
  let crystals = 0;
  if (firstClear) {
    coins += 50 + 25 * chapterId;
    xp += 80 + 30 * chapterId;
    crystals += level === BOSS_LEVEL ? 25 + 5 * chapterId : 2 + Math.floor(chapterId / 3);
  }
  if (bossDefeated) {
    coins += 300 + 120 * chapterId;
    xp += 200 + 60 * chapterId;
    crystals += 10 + 3 * chapterId;
  }
  return { coins, xp, crystals };
}

// Hero XP curve: XP needed to go from `level` to `level + 1`.
export function heroXpToNext(level) {
  return 60 + 15 * level;
}

export function heroLevelFromXp(xp) {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (level < HERO_MAX_LEVEL && remaining >= heroXpToNext(level)) {
    remaining -= heroXpToNext(level);
    level += 1;
  }
  const xpToNext = level >= HERO_MAX_LEVEL ? 0 : heroXpToNext(level);
  return { level, xpIntoLevel: remaining, xpToNext };
}

// Player account XP curve.
export function playerXpToNext(level) {
  return 100 + 50 * level;
}

export function playerLevelFromXp(xp) {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (level < PLAYER_MAX_LEVEL && remaining >= playerXpToNext(level)) {
    remaining -= playerXpToNext(level);
    level += 1;
  }
  const xpToNext = level >= PLAYER_MAX_LEVEL ? 0 : playerXpToNext(level);
  return { level, xpIntoLevel: remaining, xpToNext };
}

// Computes gameplay stats for a hero from persistent state plus equipped items.
// heroState: { xp, upgrades:{hp,atk,def,skill}, alloc:{hp,atk,def}, ascension }
// equipped: [{ atk, def, hp }]
export function computeHeroStats(heroId, heroState, equipped = []) {
  const hero = HEROES[heroId];
  if (!hero) throw new Error('Unknown hero');
  const up = { hp: 0, atk: 0, def: 0, skill: 0, ...(heroState.upgrades || {}) };
  const alloc = { hp: 0, atk: 0, def: 0, ...(heroState.alloc || {}) };
  const ascension = Math.min(ASCEND.max, heroState.ascension || 0);
  const { level, xpIntoLevel, xpToNext } = heroLevelFromXp(heroState.xp || 0);
  const lv = level - 1;
  const hpRaw = hero.base.hp + hero.growth.hp * lv + up.hp * UPGRADE.hp.perTier + alloc.hp * ALLOC_POINT.hp;
  const atkRaw = hero.base.atk + hero.growth.atk * lv + up.atk * UPGRADE.atk.perTier + alloc.atk * ALLOC_POINT.atk;
  const defRaw = hero.base.def + hero.growth.def * lv + up.def * UPGRADE.def.perTier + alloc.def * ALLOC_POINT.def;
  const mult = 1 + ASCEND.statBonus * ascension;
  const eq = equipped.reduce((acc, it) => ({
    hp: acc.hp + (it.hp || 0), atk: acc.atk + (it.atk || 0), def: acc.def + (it.def || 0),
  }), { hp: 0, atk: 0, def: 0 });
  const skillLevel = 1 + Math.min(UPGRADE.skill.max - 1, up.skill);
  return {
    heroId,
    level,
    xpIntoLevel,
    xpToNext,
    maxHp: Math.round(hpRaw * mult) + eq.hp,
    atk: Math.round(atkRaw * mult) + eq.atk,
    def: Math.round(defRaw * mult) + eq.def,
    skillLevel,
    skillMult: +(hero.skill.mult * (1 + 0.2 * (skillLevel - 1))).toFixed(3),
    skillCooldown: hero.skill.cooldown,
    mana: hero.mana,
    speed: hero.speed,
    range: hero.range,
    style: hero.style,
  };
}

// Rules for team composition: selected hero first, then up to MAX_TEAM-1 owned companions.
export function normalizeTeam(selectedHero, team, owned) {
  const ownedSet = new Set(owned);
  const out = [];
  const push = (id) => {
    if (id && HEROES[id] && ownedSet.has(id) && !out.includes(id) && out.length < MAX_TEAM) out.push(id);
  };
  push(selectedHero);
  (Array.isArray(team) ? team : []).forEach(push);
  return out;
}

export function tierCost(stat, currentTier) {
  const cfg = UPGRADE[stat];
  return { coins: cfg.coins(currentTier), ore: stat === 'skill' ? 0 : cfg.ore(currentTier), shards: stat === 'skill' ? cfg.shards(currentTier) : 0 };
}

export function bossForChapter(chapterId) {
  const chapter = chapterById(chapterId);
  return chapter ? BOSSES[chapter.boss] : null;
}

export { MAX_TEAM };
