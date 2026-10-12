// Server-authoritative game state: saves, summons, unlocks, upgrades, inventory,
// shop and battle rewards. Every mutating function runs inside a DB transaction
// and returns the full player state so the client can re-render from truth.
import { randomInt, randomUUID } from 'node:crypto';
import {
  HEROES, HERO_IDS, STARTER_HERO, GACHA, RARITY, RARITIES, POTIONS, MATERIALS, SHOP,
  WEAPON_TEMPLATES, ARMOR_TEMPLATES, UPGRADE, ASCEND, ACHIEVEMENTS, STARTING, DEFAULT_SETTINGS,
  CHAPTERS, BOSSES, MAX_TEAM, BOSS_LEVEL, LEVELS_PER_CHAPTER,
} from '../shared/data.js';
import {
  levelKey, isLevelUnlocked, isChapterCompleted, countCompletedChapters, levelComposition,
  validateKills, levelRewards, heroLevelFromXp, playerLevelFromXp, computeHeroStats,
  normalizeTeam, tierCost, enemyScale, parseMobKey,
} from '../shared/rules.js';
import { tx } from './db.js';

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const now = () => Date.now();

// ---------------------------------------------------------------------------
// Random helpers (crypto-backed; used for every roll that matters)
// ---------------------------------------------------------------------------
function rollWeighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = randomInt(total);
  for (const [value, w] of entries) {
    if (r < w) return value;
    r -= w;
  }
  return entries[entries.length - 1][0];
}
const chance = (p) => randomInt(1_000_000) < Math.round(p * 1_000_000);
const pick = (arr) => arr[randomInt(arr.length)];
const rangeInt = (lo, hi) => lo + randomInt(hi - lo + 1);

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------
function loadPlayer(db, userId) {
  const row = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  if (!row) throw new GameError('Player profile not found', 404);
  return row;
}

function loadHeroRows(db, userId) {
  const rows = db.prepare('SELECT * FROM heroes WHERE user_id = ?').all(userId);
  return new Map(rows.map((r) => [r.hero_id, r]));
}

function loadItems(db, userId) {
  return db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY id').all(userId);
}

function loadProgressRows(db, userId) {
  return db.prepare('SELECT * FROM level_progress WHERE user_id = ?').all(userId);
}

function loadAchievementIds(db, userId) {
  return db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(userId).map((r) => r.achievement_id);
}

function loadCounts(db, userId, table, idCol) {
  const out = {};
  for (const r of db.prepare(`SELECT ${idCol} AS id, qty FROM ${table} WHERE user_id = ?`).all(userId)) out[r.id] = r.qty;
  return out;
}

function completedKeys(progressRows) {
  return new Set(progressRows.filter((r) => r.clears > 0).map((r) => levelKey(r.chapter, r.level)));
}

function itemView(row) {
  const tpl = [...WEAPON_TEMPLATES, ...ARMOR_TEMPLATES].find((t) => t.id === row.template_id);
  return {
    uid: row.id,
    templateId: row.template_id,
    name: tpl ? tpl.name : row.template_id,
    icon: tpl ? tpl.icon : 'sword',
    slot: row.slot,
    rarity: row.rarity,
    atk: row.atk,
    def: row.def,
    hp: row.hp,
    equippedBy: row.equipped_by,
  };
}

// Full player state for the client.
export function getState(db, userId) {
  const player = loadPlayer(db, userId);
  const heroRows = loadHeroRows(db, userId);
  const items = loadItems(db, userId);
  const progress = loadProgressRows(db, userId);
  const achievements = loadAchievementIds(db, userId);
  const completed = completedKeys(progress);
  const potions = loadCounts(db, userId, 'potions', 'item_id');
  const materials = loadCounts(db, userId, 'materials', 'item_id');
  const owned = HERO_IDS.filter((id) => heroRows.get(id)?.owned);
  const pl = playerLevelFromXp(player.xp);

  const heroes = {};
  for (const id of HERO_IDS) {
    const r = heroRows.get(id) || {
      owned: 0, xp: 0, upgrade_hp: 0, upgrade_atk: 0, upgrade_def: 0, upgrade_skill: 0,
      alloc_hp: 0, alloc_atk: 0, alloc_def: 0, ascension: 0, fragments: 0,
    };
    const equipped = items.filter((it) => it.equipped_by === id);
    const stats = computeHeroStats(id, {
      xp: r.xp,
      upgrades: { hp: r.upgrade_hp, atk: r.upgrade_atk, def: r.upgrade_def, skill: r.upgrade_skill },
      alloc: { hp: r.alloc_hp, atk: r.alloc_atk, def: r.alloc_def },
      ascension: r.ascension,
    }, equipped);
    heroes[id] = {
      id,
      owned: !!r.owned,
      xp: r.xp,
      level: stats.level,
      xpIntoLevel: stats.xpIntoLevel,
      xpToNext: stats.xpToNext,
      upgrades: { hp: r.upgrade_hp, atk: r.upgrade_atk, def: r.upgrade_def, skill: r.upgrade_skill },
      alloc: { hp: r.alloc_hp, atk: r.alloc_atk, def: r.alloc_def },
      ascension: r.ascension,
      fragments: r.fragments,
      stats: { maxHp: stats.maxHp, atk: stats.atk, def: stats.def, skillLevel: stats.skillLevel, skillMult: stats.skillMult },
      equipment: {
        weapon: equipped.find((e) => e.slot === 'weapon')?.id ?? null,
        armor: equipped.find((e) => e.slot === 'armor')?.id ?? null,
      },
    };
  }

  const levels = {};
  for (const r of progress) levels[levelKey(r.chapter, r.level)] = { clears: r.clears, bestKills: r.best_kills };

  return {
    user: loadUserView(db, userId),
    player: {
      level: pl.level,
      xp: player.xp,
      xpIntoLevel: pl.xpIntoLevel,
      xpToNext: pl.xpToNext,
      statPoints: player.stat_points,
      coins: player.coins,
      crystals: player.crystals,
      selectedHero: player.selected_hero,
      team: JSON.parse(player.team_json || '[]'),
      settings: { ...DEFAULT_SETTINGS, ...JSON.parse(player.settings_json || '{}') },
      pity: { epic: player.pity_epic, legendary: player.pity_legendary },
      stats: {
        totalKills: player.total_kills,
        bossesDefeated: player.bosses_defeated,
        summons: player.summons,
        heroesOwned: owned.length,
        chaptersCompleted: countCompletedChapters(completed),
      },
    },
    heroes,
    items: items.map(itemView),
    potions,
    materials,
    campaign: {
      completed: [...completed],
      levels,
      totalLevels: CHAPTERS.length * LEVELS_PER_CHAPTER,
    },
    achievements,
    // Keep defaults in sync for clients that read these from the server.
    constants: { gacha: GACHA, rarity: RARITY, rarities: RARITIES },
  };
}

function loadUserView(db, userId) {
  const u = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(userId);
  return u ? { id: u.id, username: u.username, email: u.email, createdAt: u.created_at } : null;
}

// ---------------------------------------------------------------------------
// Account creation
// ---------------------------------------------------------------------------
export function initPlayer(db, userId) {
  const t = now();
  db.prepare(`INSERT INTO players (user_id, coins, crystals, selected_hero, team_json, settings_json, updated_at)
              VALUES (?, ?, ?, ?, '[]', ?, ?)`)
    .run(userId, STARTING.coins, STARTING.crystals, STARTER_HERO, JSON.stringify(DEFAULT_SETTINGS), t);
  const insHero = db.prepare('INSERT INTO heroes (user_id, hero_id, owned) VALUES (?, ?, ?)');
  for (const id of HERO_IDS) insHero.run(userId, id, id === STARTER_HERO ? 1 : 0);
  for (const [id, qty] of Object.entries(STARTING.potions)) {
    db.prepare('INSERT INTO potions (user_id, item_id, qty) VALUES (?, ?, ?)').run(userId, id, qty);
  }
  for (const id of Object.keys(MATERIALS)) {
    db.prepare('INSERT INTO materials (user_id, item_id, qty) VALUES (?, ?, ?)').run(userId, id, 0);
  }
}

// ---------------------------------------------------------------------------
// Achievements and automatic hero unlocks
// ---------------------------------------------------------------------------
function achievementStats(db, userId) {
  const p = loadPlayer(db, userId);
  const heroRows = loadHeroRows(db, userId);
  const owned = HERO_IDS.filter((id) => heroRows.get(id)?.owned).length;
  const completed = completedKeys(loadProgressRows(db, userId));
  return {
    totalKills: p.total_kills,
    bossesDefeated: p.bosses_defeated,
    summons: p.summons,
    heroesOwned: owned,
    chaptersCompleted: countCompletedChapters(completed),
  };
}

// Grants achievements, their crystal rewards and automatic hero unlocks.
function checkAchievements(db, userId) {
  const stats = achievementStats(db, userId);
  const have = new Set(loadAchievementIds(db, userId));
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id) || stats[a.stat] < a.min) continue;
    db.prepare('INSERT INTO achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)').run(userId, a.id, now());
    db.prepare('UPDATE players SET crystals = crystals + ? WHERE user_id = ?').run(a.crystals, userId);
  }
  autoUnlockHeroes(db, userId);
}

// Heroes unlocked by chapter clears, boss kills or achievements are granted automatically.
function autoUnlockHeroes(db, userId) {
  const heroRows = loadHeroRows(db, userId);
  const completed = completedKeys(loadProgressRows(db, userId));
  const achievements = new Set(loadAchievementIds(db, userId));
  for (const id of HERO_IDS) {
    const hero = HEROES[id];
    const row = heroRows.get(id);
    if (!row || row.owned) continue;
    const u = hero.unlock;
    let ok = false;
    if (u.type === 'chapter') ok = isChapterCompleted(completed, u.chapter);
    else if (u.type === 'boss') {
      const chapter = CHAPTERS.find((c) => c.boss === u.boss);
      ok = !!chapter && isChapterCompleted(completed, chapter.id);
    } else if (u.type === 'achievement') ok = achievements.has(u.id);
    if (ok) db.prepare('UPDATE heroes SET owned = 1 WHERE user_id = ? AND hero_id = ?').run(userId, id);
  }
}

// ---------------------------------------------------------------------------
// Settings, team, hero selection
// ---------------------------------------------------------------------------
export function updateSettings(db, userId, patch) {
  return tx(db, () => {
    const p = loadPlayer(db, userId);
    const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(p.settings_json || '{}') };
    if (patch.musicVolume !== undefined) merged.musicVolume = clamp01(patch.musicVolume);
    if (patch.sfxVolume !== undefined) merged.sfxVolume = clamp01(patch.sfxVolume);
    if (patch.showDamageNumbers !== undefined) merged.showDamageNumbers = !!patch.showDamageNumbers;
    if (patch.screenShake !== undefined) merged.screenShake = !!patch.screenShake;
    db.prepare('UPDATE players SET settings_json = ?, updated_at = ? WHERE user_id = ?').run(JSON.stringify(merged), now(), userId);
    return getState(db, userId);
  });
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new GameError('Invalid volume');
  return Math.min(1, Math.max(0, n));
}

export function setTeam(db, userId, selectedHero, team) {
  return tx(db, () => {
    const heroRows = loadHeroRows(db, userId);
    const owned = HERO_IDS.filter((id) => heroRows.get(id)?.owned);
    if (!HEROES[selectedHero] || !owned.includes(selectedHero)) throw new GameError('Hero is not owned');
    if (team !== undefined && !Array.isArray(team)) throw new GameError('Invalid team');
    if (Array.isArray(team) && team.length > MAX_TEAM) throw new GameError('Team is too large');
    for (const id of team || []) {
      if (!HEROES[id]) throw new GameError('Unknown hero');
      if (!owned.includes(id)) throw new GameError(`${HEROES[id].name} is not owned`);
    }
    const normalized = normalizeTeam(selectedHero, team || [], owned);
    db.prepare('UPDATE players SET selected_hero = ?, team_json = ?, updated_at = ? WHERE user_id = ?')
      .run(selectedHero, JSON.stringify(normalized.slice(1)), now(), userId);
    return getState(db, userId);
  });
}

// ---------------------------------------------------------------------------
// Hero unlocks, upgrades, ascension, stat points
// ---------------------------------------------------------------------------
export function unlockHero(db, userId, heroId) {
  return tx(db, () => {
    const hero = HEROES[heroId];
    if (!hero) throw new GameError('Unknown hero', 404);
    const row = loadHeroRows(db, userId).get(heroId);
    if (row?.owned) throw new GameError('Hero already owned');
    const u = hero.unlock;
    if (u.type === 'coins') {
      spend(db, userId, { coins: u.cost });
    } else if (u.type === 'fragments' || (u.type === 'gacha' && u.cost)) {
      if ((row?.fragments || 0) < u.cost) throw new GameError(`Need ${u.cost} fragments`);
      db.prepare('UPDATE heroes SET fragments = fragments - ?, owned = 1 WHERE user_id = ? AND hero_id = ?').run(u.cost, userId, heroId);
      return getState(db, userId);
    } else {
      throw new GameError(`This hero is unlocked by: ${u.text}`);
    }
    db.prepare('UPDATE heroes SET owned = 1 WHERE user_id = ? AND hero_id = ?').run(userId, heroId);
    checkAchievements(db, userId);
    return getState(db, userId);
  });
}

// Deduct currency; throws when the player cannot afford it.
function spend(db, userId, cost) {
  const p = loadPlayer(db, userId);
  if ((cost.coins || 0) > p.coins) throw new GameError('Not enough coins');
  if ((cost.crystals || 0) > p.crystals) throw new GameError('Not enough crystals');
  db.prepare('UPDATE players SET coins = coins - ?, crystals = crystals - ?, updated_at = ? WHERE user_id = ?')
    .run(cost.coins || 0, cost.crystals || 0, now(), userId);
}

function ownedHeroRow(db, userId, heroId) {
  if (!HEROES[heroId]) throw new GameError('Unknown hero', 404);
  const row = loadHeroRows(db, userId).get(heroId);
  if (!row?.owned) throw new GameError('Hero is not owned');
  return row;
}

export function upgradeHero(db, userId, heroId, stat) {
  return tx(db, () => {
    const row = ownedHeroRow(db, userId, heroId);
    if (!['hp', 'atk', 'def', 'skill'].includes(stat)) throw new GameError('Unknown upgrade');
    const col = `upgrade_${stat}`;
    const tier = row[col];
    if (tier >= UPGRADE[stat].max) throw new GameError('Already at max tier');
    const cost = tierCost(stat, tier);
    const p = loadPlayer(db, userId);
    if (p.coins < cost.coins) throw new GameError('Not enough coins');
    if (cost.ore > 0) {
      const ore = loadCounts(db, userId, 'materials', 'item_id').iron_ore || 0;
      if (ore < cost.ore) throw new GameError(`Need ${cost.ore} Iron Ore`);
      addMaterial(db, userId, 'iron_ore', -cost.ore);
    }
    if (cost.shards > 0) {
      const shards = loadCounts(db, userId, 'materials', 'item_id').rune_shard || 0;
      if (shards < cost.shards) throw new GameError(`Need ${cost.shards} Rune Shards`);
      addMaterial(db, userId, 'rune_shard', -cost.shards);
    }
    db.prepare('UPDATE players SET coins = coins - ?, updated_at = ? WHERE user_id = ?').run(cost.coins, now(), userId);
    db.prepare(`UPDATE heroes SET ${col} = ${col} + 1 WHERE user_id = ? AND hero_id = ?`).run(userId, heroId);
    return getState(db, userId);
  });
}

export function allocatePoint(db, userId, heroId, stat) {
  return tx(db, () => {
    ownedHeroRow(db, userId, heroId);
    if (!['hp', 'atk', 'def'].includes(stat)) throw new GameError('Unknown stat');
    const p = loadPlayer(db, userId);
    if (p.stat_points < 1) throw new GameError('No stat points available');
    db.prepare('UPDATE players SET stat_points = stat_points - 1, updated_at = ? WHERE user_id = ?').run(now(), userId);
    db.prepare(`UPDATE heroes SET alloc_${stat} = alloc_${stat} + 1 WHERE user_id = ? AND hero_id = ?`).run(userId, heroId);
    return getState(db, userId);
  });
}

export function ascendHero(db, userId, heroId) {
  return tx(db, () => {
    const row = ownedHeroRow(db, userId, heroId);
    if (row.ascension >= ASCEND.max) throw new GameError('Already fully ascended');
    if (row.fragments < ASCEND.fragments) throw new GameError(`Need ${ASCEND.fragments} fragments`);
    db.prepare('UPDATE heroes SET fragments = fragments - ?, ascension = ascension + 1 WHERE user_id = ? AND hero_id = ?')
      .run(ASCEND.fragments, userId, heroId);
    return getState(db, userId);
  });
}

// ---------------------------------------------------------------------------
// Shop, materials and potions
// ---------------------------------------------------------------------------
function addMaterial(db, userId, id, delta) {
  db.prepare(`INSERT INTO materials (user_id, item_id, qty) VALUES (?, ?, MAX(0, ?))
              ON CONFLICT(user_id, item_id) DO UPDATE SET qty = MAX(0, qty + excluded.qty)`).run(userId, id, delta);
}

function addPotion(db, userId, id, delta) {
  db.prepare(`INSERT INTO potions (user_id, item_id, qty) VALUES (?, ?, MAX(0, ?))
              ON CONFLICT(user_id, item_id) DO UPDATE SET qty = MAX(0, qty + excluded.qty)`).run(userId, id, delta);
}

export function buyShopItem(db, userId, itemId) {
  return tx(db, () => {
    const entry = [...SHOP.potions, ...SHOP.materials].find((e) => e.id === itemId);
    if (!entry) throw new GameError('Unknown shop item', 404);
    spend(db, userId, { coins: entry.price });
    if (entry.kind === 'potion') addPotion(db, userId, entry.id, entry.qty);
    else addMaterial(db, userId, entry.id, entry.qty);
    return getState(db, userId);
  });
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export function equipItem(db, userId, uid, heroId) {
  return tx(db, () => {
    ownedHeroRow(db, userId, heroId);
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(uid, userId);
    if (!item) throw new GameError('Item not found', 404);
    // Only one item per slot per hero: displace the current one.
    db.prepare('UPDATE items SET equipped_by = NULL WHERE user_id = ? AND equipped_by = ? AND slot = ?').run(userId, heroId, item.slot);
    db.prepare('UPDATE items SET equipped_by = ? WHERE id = ?').run(heroId, uid);
    return getState(db, userId);
  });
}

export function unequipItem(db, userId, uid) {
  return tx(db, () => {
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(uid, userId);
    if (!item) throw new GameError('Item not found', 404);
    db.prepare('UPDATE items SET equipped_by = NULL WHERE id = ?').run(uid);
    return getState(db, userId);
  });
}

// Dismantling converts a non-equipped item into Iron Ore by rarity.
const DISMANTLE_ORE = { common: 1, rare: 2, epic: 4, legendary: 8 };
export function dismantleItem(db, userId, uid) {
  return tx(db, () => {
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(uid, userId);
    if (!item) throw new GameError('Item not found', 404);
    if (item.equipped_by) throw new GameError('Unequip the item first');
    db.prepare('DELETE FROM items WHERE id = ?').run(uid);
    addMaterial(db, userId, 'iron_ore', DISMANTLE_ORE[item.rarity] || 1);
    return getState(db, userId);
  });
}

// Creates an equipment item with stats scaled by rarity and chapter.
function createEquipment(db, userId, { chapterId, minRarity = 'common' }) {
  const minIdx = RARITIES.indexOf(minRarity);
  const weights = RARITIES.map((r, i) => [r, i < minIdx ? 0 : RARITY[r].weight]);
  const rarity = rollWeighted(weights);
  const slot = chance(0.5) ? 'weapon' : 'armor';
  const pool = slot === 'weapon' ? WEAPON_TEMPLATES : ARMOR_TEMPLATES;
  const tpl = pick(pool);
  const mult = RARITY[rarity].statMult * (1 + 0.08 * (chapterId - 1));
  const vary = () => 0.9 + randomInt(21) / 100;
  const scale = (v) => (v > 0 ? Math.max(1, Math.round(v * mult * vary())) : 0);
  const info = {
    template_id: tpl.id,
    slot,
    rarity,
    atk: slot === 'weapon' ? scale(tpl.atk) : 0,
    def: slot === 'armor' ? scale(tpl.def) : 0,
    hp: scale(tpl.hp),
  };
  db.prepare('INSERT INTO items (user_id, template_id, slot, rarity, atk, def, hp) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, info.template_id, info.slot, info.rarity, info.atk, info.def, info.hp);
  return info;
}

// ---------------------------------------------------------------------------
// Gacha
// ---------------------------------------------------------------------------
// Integer weights (rates x 10000) so crypto.randomInt can pick a rarity exactly.
const GACHA_RATES = Object.entries(GACHA.rates).map(([rarity, rate]) => [rarity, Math.round(rate * 10000)]);

export function summon(db, userId, { count, currency }) {
  if (count !== 1 && count !== GACHA.multiCount) throw new GameError('Summon count must be 1 or 10');
  if (currency !== 'coins' && currency !== 'crystals') throw new GameError('Currency must be coins or crystals');
  return tx(db, () => {
    const cost = currency === 'coins'
      ? (count === 1 ? GACHA.singleCostCoins : GACHA.multiCostCoins)
      : (count === 1 ? GACHA.singleCostCrystals : GACHA.multiCostCrystals);
    spend(db, userId, currency === 'coins' ? { coins: cost } : { crystals: cost });

    const p = loadPlayer(db, userId);
    let pityEpic = p.pity_epic;
    let pityLeg = p.pity_legendary;
    const batchId = randomUUID();
    const heroRows = loadHeroRows(db, userId);
    const results = [];
    const { epicAfter, legendaryAfter, legendaryShareOfEpicPity } = GACHA.pity;

    for (let i = 0; i < count; i += 1) {
      let rarity;
      let pityHit = false;
      if (pityLeg + 1 >= legendaryAfter) {
        rarity = 'legendary';
        pityHit = true;
      } else if (pityEpic + 1 >= epicAfter) {
        rarity = chance(legendaryShareOfEpicPity) ? 'legendary' : 'epic';
        pityHit = true;
      } else {
        rarity = rollWeighted(GACHA_RATES);
      }
      if (rarity === 'legendary') { pityEpic = 0; pityLeg = 0; }
      else if (rarity === 'epic') { pityEpic = 0; pityLeg += 1; }
      else { pityEpic += 1; pityLeg += 1; }

      const heroId = pick(GACHA.pools[rarity]);
      const row = heroRows.get(heroId);
      let duplicate = false;
      let fragments = 0;
      if (row?.owned) {
        duplicate = true;
        fragments = RARITY[rarity].fragments;
        db.prepare('UPDATE heroes SET fragments = fragments + ? WHERE user_id = ? AND hero_id = ?').run(fragments, userId, heroId);
      } else {
        db.prepare('UPDATE heroes SET owned = 1 WHERE user_id = ? AND hero_id = ?').run(userId, heroId);
        heroRows.set(heroId, { ...row, owned: 1 });
      }
      db.prepare(`INSERT INTO summon_history (user_id, created_at, batch_id, source, hero_id, rarity, duplicate, fragments, pity, cost_coins, cost_crystals)
                  VALUES (?, ?, ?, 'gacha', ?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, now(), batchId, heroId, rarity, duplicate ? 1 : 0, fragments, pityHit ? 1 : 0,
          currency === 'coins' ? cost : 0, currency === 'crystals' ? cost : 0);
      results.push({ heroId, rarity, duplicate, fragments, pity: pityHit, isNew: !duplicate });
    }

    db.prepare('UPDATE players SET pity_epic = ?, pity_legendary = ?, summons = summons + ?, updated_at = ? WHERE user_id = ?')
      .run(pityEpic, pityLeg, count, now(), userId);
    checkAchievements(db, userId);
    return { batchId, results, state: getState(db, userId) };
  });
}

export function summonHistory(db, userId, limit = 50) {
  return db.prepare(`SELECT batch_id, created_at, hero_id, rarity, duplicate, fragments, pity, cost_coins, cost_crystals
                     FROM summon_history WHERE user_id = ? ORDER BY id DESC LIMIT ?`).all(userId, limit)
    .map((r) => ({
      batchId: r.batch_id, at: r.created_at, heroId: r.hero_id, rarity: r.rarity,
      duplicate: !!r.duplicate, fragments: r.fragments, pity: !!r.pity,
      costCoins: r.cost_coins, costCrystals: r.cost_crystals,
    }));
}

// ---------------------------------------------------------------------------
// Battles: server validates requests and computes all rewards.
// Sessions are in memory; a restart simply voids open battles.
// ---------------------------------------------------------------------------
const POTION_COOLDOWN_S = 5;
const battles = new Map();
const BATTLE_TTL_MS = 4 * 60 * 60 * 1000;

function pruneBattles() {
  const t = now();
  for (const [id, b] of battles) if (t - b.startedAt > BATTLE_TTL_MS) battles.delete(id);
}

export function startBattle(db, userId, { chapter, level, team }) {
  const chapterId = Number(chapter);
  const levelNo = Number(level);
  if (!Number.isInteger(chapterId) || !CHAPTERS.some((c) => c.id === chapterId)) throw new GameError('Unknown chapter', 404);
  if (!Number.isInteger(levelNo) || levelNo < 1 || levelNo > LEVELS_PER_CHAPTER) throw new GameError('Unknown level', 404);
  return tx(db, () => {
    const progress = loadProgressRows(db, userId);
    const done = completedKeys(progress);
    if (!isLevelUnlocked(done, chapterId, levelNo)) throw new GameError('Level is locked');
    const p = loadPlayer(db, userId);
    const heroRows = loadHeroRows(db, userId);
    const owned = HERO_IDS.filter((id) => heroRows.get(id)?.owned);
    const members = normalizeTeam(p.selected_hero, team || JSON.parse(p.team_json || '[]'), owned);
    const items = loadItems(db, userId);
    const heroes = members.map((id) => {
      const r = heroRows.get(id);
      const equipped = items.filter((it) => it.equipped_by === id);
      const s = computeHeroStats(id, {
        xp: r.xp,
        upgrades: { hp: r.upgrade_hp, atk: r.upgrade_atk, def: r.upgrade_def, skill: r.upgrade_skill },
        alloc: { hp: r.alloc_hp, atk: r.alloc_atk, def: r.alloc_def },
        ascension: r.ascension,
      }, equipped);
      return { id, level: s.level, xpIntoLevel: s.xpIntoLevel, xpToNext: s.xpToNext, maxHp: s.maxHp, atk: s.atk, def: s.def, skillMult: s.skillMult, skillCooldown: s.skillCooldown, mana: s.mana, speed: s.speed, range: s.range, style: s.style };
    });
    const comp = levelComposition(chapterId, levelNo);
    const scaling = {};
    for (const key of Object.keys(comp.mobs)) {
      const { elite } = parseMobKey(key);
      scaling[key] = enemyScale(chapterId, levelNo, elite);
    }
    const battleId = randomUUID();
    pruneBattles();
    battles.set(battleId, { id: battleId, userId, chapter: chapterId, level: levelNo, members, startedAt: now() });
    const potions = loadCounts(db, userId, 'potions', 'item_id');
    return {
      battleId,
      chapter: chapterId,
      level: levelNo,
      kind: comp.kind,
      composition: { mobs: comp.mobs, boss: comp.boss, minions: comp.minions || [], maxKills: comp.maxKills },
      scaling,
      heroes,
      potions,
      boss: comp.boss ? { id: comp.boss, ...BOSSES[comp.boss] } : null,
    };
  });
}

export function abortBattle(userId, battleId) {
  const b = battles.get(battleId);
  if (b && b.userId === userId) battles.delete(battleId);
  return { ok: true };
}

export function completeBattle(db, userId, body) {
  const b = battles.get(body.battleId);
  if (!b || b.userId !== userId) throw new GameError('Battle not found or expired', 404);
  const duration = Number(body.durationSec);
  if (!Number.isInteger(duration) || duration < 1 || duration > 4 * 60 * 60) throw new GameError('Invalid battle duration');
  const kills = validateKills(b.chapter, b.level, body.kills || {});
  if (!kills.ok) throw new GameError(kills.error);
  const bossDefeated = body.bossDefeated === true;
  if (bossDefeated && b.level !== BOSS_LEVEL) throw new GameError('Boss defeat only counts on boss levels');

  const used = body.potionsUsed || {};
  const potionUse = {};
  let usedTotal = 0;
  for (const id of Object.keys(POTIONS)) {
    const n = Number(used[id] || 0);
    if (!Number.isInteger(n) || n < 0) throw new GameError('Invalid potion count');
    potionUse[id] = n;
    usedTotal += n;
  }
  // Potions have a 5s cooldown, so a battle of N seconds allows at most N/5 + 1 uses.
  if (usedTotal > Math.floor(duration / POTION_COOLDOWN_S) + 1) throw new GameError('Too many potions used for battle length');

  // Cleared = every enemy in the level (mobs/elite) or the boss.
  const cleared = b.level === BOSS_LEVEL ? bossDefeated : kills.total >= levelComposition(b.chapter, b.level).maxKills;

  battles.delete(b.id);
  return tx(db, () => {
    const potionsNow = loadCounts(db, userId, 'potions', 'item_id');
    for (const id of Object.keys(POTIONS)) {
      if (potionUse[id] > (potionsNow[id] || 0)) throw new GameError(`Not enough ${POTIONS[id].name}s`);
    }
    for (const id of Object.keys(POTIONS)) if (potionUse[id]) addPotion(db, userId, id, -potionUse[id]);

    const progress = loadProgressRows(db, userId);
    const prev = progress.find((r) => r.chapter === b.chapter && r.level === b.level);
    const firstClear = cleared && !(prev && prev.clears > 0);
    const rewards = levelRewards(b.chapter, b.level, kills.kills, { firstClear, bossDefeated });
    const chapterBonus = firstClear && b.level === BOSS_LEVEL
      ? { coins: 1000 + 300 * b.chapter, crystals: 30 + 5 * b.chapter }
      : { coins: 0, crystals: 0 };
    rewards.coins += chapterBonus.coins;
    rewards.crystals += chapterBonus.crystals;

    const drops = rollDrops(db, userId, b, kills);
    if (bossDefeated) drops.chest = grantBossChest(db, userId, b.chapter);
    const playerBefore = loadPlayer(db, userId);
    const levelBefore = playerLevelFromXp(playerBefore.xp).level;
    const newXp = playerBefore.xp + rewards.xp;
    const levelAfter = playerLevelFromXp(newXp).level;
    const levelsGained = levelAfter - levelBefore;

    db.prepare(`UPDATE players SET coins = coins + ?, crystals = crystals + ?, xp = ?, stat_points = stat_points + ?,
                total_kills = total_kills + ?, bosses_defeated = bosses_defeated + ?, updated_at = ?
                WHERE user_id = ?`)
      .run(rewards.coins, rewards.crystals, newXp, levelsGained * 2, kills.total,
        bossDefeated ? 1 : 0, now(), userId);

    // Hero XP: the lead hero gets the full amount, companions half.
    const heroRows = loadHeroRows(db, userId);
    b.members.forEach((id, idx) => {
      const r = heroRows.get(id);
      const gain = idx === 0 ? rewards.xp : Math.floor(rewards.xp / 2);
      db.prepare('UPDATE heroes SET xp = ? WHERE user_id = ? AND hero_id = ?').run(r.xp + gain, userId, id);
    });

    const killCount = kills.total;
    if (cleared || killCount > 0) {
      db.prepare(`INSERT INTO level_progress (user_id, chapter, level, clears, best_kills, first_cleared_at)
                  VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(user_id, chapter, level) DO UPDATE SET
                    clears = clears + excluded.clears,
                    best_kills = MAX(best_kills, excluded.best_kills),
                    first_cleared_at = COALESCE(first_cleared_at, excluded.first_cleared_at)`)
        .run(userId, b.chapter, b.level, cleared ? 1 : 0, killCount, cleared ? now() : null);
    }

    checkAchievements(db, userId);
    return {
      cleared,
      firstClear,
      rewards,
      drops,
      levelsGained,
      state: getState(db, userId),
    };
  });
}

function rollDrops(db, userId, battle, kills) {
  const drops = { items: [], materials: {}, potions: {} };
  const grantMaterial = (id, n) => {
    if (n <= 0) return;
    addMaterial(db, userId, id, n);
    drops.materials[id] = (drops.materials[id] || 0) + n;
  };
  const grantPotion = (id, n) => {
    addPotion(db, userId, id, n);
    drops.potions[id] = (drops.potions[id] || 0) + n;
  };
  const grantItem = (opts) => {
    const info = createEquipment(db, userId, { chapterId: battle.chapter, ...opts });
    drops.items.push({ templateId: info.template_id, slot: info.slot, rarity: info.rarity });
  };

  for (const [key, count] of Object.entries(kills.kills)) {
    const { elite } = parseMobKey(key);
    for (let i = 0; i < count; i += 1) {
      if (chance(elite ? 0.6 : 0.25)) grantMaterial('iron_ore', elite ? 2 : 1);
      if (chance(elite ? 0.25 : 0.06)) grantMaterial('rune_shard', 1);
      if (chance(elite ? 0.2 : 0.06)) grantPotion('health_potion', 1);
      if (chance(elite ? 0.05 : 0.01)) grantPotion('greater_potion', 1);
      if (chance(elite ? 0.12 : 0.03)) grantItem({ chapterId: battle.chapter });
    }
  }

  return drops;
}

// Boss chest: granted separately so it can depend on bossDefeated.
export function grantBossChest(db, userId, chapterId) {
  const minRarity = chapterId <= 3 ? 'rare' : 'epic';
  const chest = { ore: rangeInt(8, 12), shards: rangeInt(3, 6), items: [] };
  addMaterial(db, userId, 'iron_ore', chest.ore);
  addMaterial(db, userId, 'rune_shard', chest.shards);
  addPotion(db, userId, 'greater_potion', 1);
  for (let i = 0; i < 2; i += 1) {
    const info = createEquipment(db, userId, { chapterId, minRarity });
    chest.items.push({ templateId: info.template_id, slot: info.slot, rarity: info.rarity });
  }
  return chest;
}
