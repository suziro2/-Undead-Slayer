import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, HEROES, HERO_IDS, BOSS_LEVEL, GACHA, ACHIEVEMENTS, ENEMIES, BOSSES } from '../shared/data.js';
import {
  isLevelUnlocked, isChapterCompleted, levelComposition, validateKills, levelRewards, heroLevelFromXp,
  playerLevelFromXp, computeHeroStats, normalizeTeam, tierCost, enemyScale,
} from '../shared/rules.js';

test('content has 10 chapters x 5 levels, 10 heroes, 10 unique bosses', () => {
  assert.equal(CHAPTERS.length, 10);
  assert.equal(HERO_IDS.length, 10);
  const bosses = new Set(CHAPTERS.map((c) => c.boss));
  assert.equal(bosses.size, 10);
  for (const c of CHAPTERS) assert.ok(BOSSES[c.boss], `boss ${c.boss} defined`);
  assert.equal(CHAPTERS.length * 5, 50);
});

test('every hero has a skill, unlock rule, rarity and the required names', () => {
  const names = ['Aiden', 'Luna', 'Ronan', 'Mira', 'Kael', 'Bruno', 'Sylvie', 'Darius', 'Elian', 'Riven'];
  assert.deepEqual(Object.values(HEROES).map((h) => h.name), names);
  for (const h of Object.values(HEROES)) {
    assert.ok(h.skill.name && h.skill.desc, h.id);
    assert.ok(h.unlock && h.unlock.text, h.id);
    assert.ok(['common', 'rare', 'epic', 'legendary'].includes(h.rarity));
  }
});

test('gacha pools cover every non-starter hero and rates sum to 100%', () => {
  const pooled = Object.values(GACHA.pools).flat().sort();
  assert.deepEqual(pooled, [...HERO_IDS].sort());
  const total = Object.values(GACHA.rates).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('levels unlock sequentially and chapters unlock after the previous boss', () => {
  assert.equal(isLevelUnlocked(new Set(), 1, 1), true);
  assert.equal(isLevelUnlocked(new Set(), 1, 2), false);
  assert.equal(isLevelUnlocked(new Set(['1-1']), 1, 2), true);
  assert.equal(isLevelUnlocked(new Set(), 2, 1), false);
  assert.equal(isLevelUnlocked(new Set(['1-5']), 2, 1), true);
  assert.equal(isChapterCompleted(new Set(['3-5']), 3), true);
});

test('compositions: mobs for 1-3, elite for 4, boss for 5, escalating enemy count', () => {
  for (const c of CHAPTERS) {
    for (let lv = 1; lv <= 5; lv += 1) {
      const comp = levelComposition(c.id, lv);
      if (lv <= 3) assert.equal(comp.kind, 'mobs');
      if (lv === 4) { assert.equal(comp.kind, 'elite'); assert.equal(comp.elites, 3); }
      if (lv === BOSS_LEVEL) { assert.equal(comp.kind, 'boss'); assert.equal(comp.boss, c.boss); }
      if (lv <= 4) {
        const sum = Object.values(comp.mobs).reduce((a, b) => a + b, 0);
        assert.equal(sum, comp.maxKills, `${c.id}-${lv} total matches maxKills`);
      }
    }
  }
  assert.ok(levelComposition(10, 3).maxKills > levelComposition(1, 3).maxKills);
});

test('kill reports are capped by composition and reject unknown enemies', () => {
  assert.equal(validateKills(1, 1, { zombie: 3, skeleton: 3, bandit: 3 }).ok, true);
  assert.equal(validateKills(1, 1, { zombie: 99 }).ok, false);
  assert.equal(validateKills(1, 1, { goblin: 1 }).ok, false);
  assert.equal(validateKills(1, 1, { nope: 1 }).ok, false);
  assert.equal(validateKills(1, 1, { zombie: -1 }).ok, false);
  assert.equal(validateKills(1, 1, 'x').ok, false);
  assert.equal(validateKills(1, 4, { 'elite:skeleton': 4 }).ok, false);
});

test('enemy scaling grows with chapter and level, elites are stronger', () => {
  const a = enemyScale(1, 1);
  const b = enemyScale(10, 4);
  assert.ok(b.hpMult > a.hpMult * 3);
  assert.ok(enemyScale(1, 1, true).hpMult > a.hpMult);
});

test('rewards: first clear bonus and boss rewards are additive and grow with chapter', () => {
  const base = levelRewards(1, 1, { zombie: 2 }, {});
  const first = levelRewards(1, 1, { zombie: 2 }, { firstClear: true });
  assert.ok(first.coins > base.coins);
  assert.ok(first.xp > base.xp);
  const boss = levelRewards(3, 5, {}, { firstClear: true, bossDefeated: true });
  assert.ok(boss.coins > levelRewards(1, 5, {}, { firstClear: true, bossDefeated: true }).coins);
  assert.ok(ENEMIES.zombie.coins > 0);
});

test('hero and player XP curves convert XP to levels', () => {
  assert.equal(heroLevelFromXp(0).level, 1);
  assert.equal(heroLevelFromXp(75).level, 2);
  assert.equal(heroLevelFromXp(74).level, 1);
  assert.equal(playerLevelFromXp(150).level, 2);
  assert.equal(playerLevelFromXp(149).level, 1);
  assert.ok(heroLevelFromXp(1e9).level <= 30);
  assert.ok(playerLevelFromXp(1e9).level <= 60);
});

test('hero stats grow with level, upgrades, allocation, ascension and equipment', () => {
  const base = computeHeroStats('aiden', { xp: 0 });
  const grown = computeHeroStats('aiden', { xp: 5000 });
  assert.ok(grown.maxHp > base.maxHp);
  const upg = computeHeroStats('aiden', { xp: 0, upgrades: { hp: 2, atk: 3, def: 1, skill: 2 } });
  assert.equal(upg.maxHp, base.maxHp + 20);
  assert.equal(upg.atk, base.atk + 3);
  assert.equal(upg.skillLevel, 3);
  const asc = computeHeroStats('aiden', { xp: 0, ascension: 5 });
  assert.ok(asc.atk > base.atk);
  const eq = computeHeroStats('aiden', { xp: 0 }, [{ atk: 5, def: 2, hp: 10 }]);
  assert.equal(eq.atk, base.atk + 5);
  assert.equal(eq.maxHp, base.maxHp + 10);
});

test('team normalisation keeps the lead, owned heroes only, max three', () => {
  assert.deepEqual(normalizeTeam('aiden', ['luna', 'bruno', 'mira'], ['aiden', 'luna', 'bruno']), ['aiden', 'luna', 'bruno']);
  assert.deepEqual(normalizeTeam('aiden', ['mira'], ['aiden']), ['aiden']);
  assert.deepEqual(normalizeTeam('mira', [], ['aiden']), []);
});

test('upgrade costs increase per tier and skills need shards', () => {
  assert.ok(tierCost('atk', 5).coins > tierCost('atk', 0).coins);
  assert.equal(tierCost('skill', 0).shards, 2);
  assert.equal(tierCost('hp', 0).ore, 1);
  assert.ok(ACHIEVEMENTS.some((a) => a.id === 'slayer_150' && a.min === 150));
});
