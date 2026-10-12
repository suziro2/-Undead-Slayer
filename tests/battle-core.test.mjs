import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  damage, enemyStats, planMobSpawns, bossStats, bossPhase, enemyDecision, bossDecision, companionDecision, MAP_W,
} from '../client/systems/battle-core.js';
import { levelComposition } from '../shared/rules.js';
import { CHAPTERS, BOSSES, ENEMIES } from '../shared/data.js';

const fixedRng = (seq) => { let i = 0; return () => seq[i++ % seq.length]; };

test('damage is never below 1 and grows with attack, shrinks with defence', () => {
  assert.equal(damage(1, 999, 1, () => 0.5), 1);
  assert.ok(damage(30, 0, 1, () => 0.5) > damage(10, 0, 1, () => 0.5));
  assert.ok(damage(30, 0, 1, () => 0.5) > damage(30, 10, 1, () => 0.5));
});

test('mob spawns match the server composition exactly and stay on the map', () => {
  for (const c of CHAPTERS) {
    for (const lv of [1, 2, 3, 4]) {
      const comp = levelComposition(c.id, lv);
      const spawns = planMobSpawns(comp, c.id, lv);
      assert.equal(spawns.length, comp.maxKills, `${c.id}-${lv}`);
      for (const s of spawns) {
        assert.ok(s.x > 0 && s.x < MAP_W, 'inside map');
        assert.ok(s.maxHp > 0 && s.atk > 0);
      }
      const counts = {};
      for (const s of spawns) counts[s.key] = (counts[s.key] || 0) + 1;
      assert.deepEqual(counts, comp.mobs);
    }
  }
});

test('enemy stats scale with chapter and elite status', () => {
  const low = enemyStats('zombie', { hpMult: 1, atkMult: 1, coinMult: 1, xpMult: 1 });
  const high = enemyStats('zombie', { hpMult: 4, atkMult: 2, coinMult: 1, xpMult: 1 });
  assert.equal(low.maxHp, ENEMIES.zombie.hp);
  assert.ok(high.maxHp > low.maxHp && high.atk > low.atk);
});

test('boss phases switch at 66% and 33% health', () => {
  assert.equal(bossPhase(1), 0);
  assert.equal(bossPhase(0.67), 0);
  assert.equal(bossPhase(0.66), 1);
  assert.equal(bossPhase(0.34), 1);
  assert.equal(bossPhase(0.33), 2);
  assert.equal(bossPhase(0), 2);
});

test('boss HP and attack grow across chapters and every boss has four attack patterns', () => {
  const first = bossStats('undead_warlord', 1);
  const last = bossStats('undead_warlord', 10);
  assert.ok(last.maxHp > first.maxHp * 2);
  for (const id of Object.keys(BOSSES)) {
    const s = bossStats(id, 1);
    assert.deepEqual(Object.keys(s.attacks).sort(), ['aoe', 'basic', 'heavy', 'special']);
    assert.equal(s.phases.length, 2);
    assert.ok(s.summons.length >= 1);
  }
});

test('enemies stay dormant until the hero comes close, then chase and attack', () => {
  const e = enemyStats('zombie', { hpMult: 1, atkMult: 1, coinMult: 1, xpMult: 1 });
  const state = { ...e, x: 800, y: 260, cd: 0, spCd: 0, awake: false };
  const far = enemyDecision(state, { px: 100, py: 260, dodging: false }, 0.1);
  assert.equal(far.moving, false);
  assert.equal(state.awake, false);
  const near = enemyDecision(state, { px: 700, py: 260, dodging: false }, 0.1);
  assert.equal(state.awake, true);
  assert.ok(near.vx < 0, 'moves toward hero');
  const adj = { ...state, x: 710, cd: 0 };
  const hit = enemyDecision(adj, { px: 700, py: 260, dodging: false }, 0.1);
  assert.equal(hit.melee, true);
});

test('ranged enemies keep their distance instead of walking into melee', () => {
  const e = { ...enemyStats('dark_mage', { hpMult: 1, atkMult: 1, coinMult: 1, xpMult: 1 }), x: 400, y: 260, cd: 0, spCd: 0, awake: true };
  const d = enemyDecision(e, { px: 380, py: 260, dodging: false }, 0.1);
  assert.ok(d.vx > 0, 'backs away from a close hero');
});

test('boss waits for the hero, then picks attacks and respects cooldowns', () => {
  const stats = bossStats('undead_warlord', 1);
  const b = { ...stats, x: 1300, y: 270, active: false, phase: 0, busy: false, facing: -1, cds: {} };
  const idle = bossDecision(b, { px: 100, py: 270 }, 0.1);
  assert.equal(b.active, false);
  assert.equal(idle.attack, null);
  const close = bossDecision(b, { px: 1250, py: 270 }, 0.1);
  assert.equal(b.active, true);
  assert.ok(close.attack !== undefined);
  const aoeFirst = bossDecision({ ...b, cds: {} }, { px: 1290, py: 270 }, 0.1);
  assert.equal(aoeFirst.attack, 'aoe', 'area attack preferred when ready');
  const basic = bossDecision({ ...b, cds: { aoe: 2, heavy: 2, special: 2, basic: 0 } }, { px: 1290, py: 270 }, 0.1);
  assert.equal(basic.attack, 'basic');
  const cooling = bossDecision({ ...b, cds: { aoe: 2, heavy: 2, special: 2, basic: 2 } }, { px: 1290, py: 270 }, 0.1);
  assert.equal(cooling.attack, null, 'no attack while every cooldown is running');
});

test('companions chase the nearest enemy in reach and otherwise follow the hero', () => {
  const c = { x: 100, y: 260, speed: 90, range: 40, mana: 0, specialCost: 25, specialReady: true, cd: 0, maxMana: 30 };
  const follow = companionDecision({ ...c }, { px: 400, y: 260, facing: 1, slot: 0, enemies: [] }, 0.1);
  assert.ok(follow.vx > 0);
  const chase = companionDecision({ ...c }, { px: 100, facing: 1, slot: 0, enemies: [{ x: 180, y: 262 }] }, 0.1);
  assert.ok(chase.vx > 0);
  assert.equal(chase.special, false);
  const attack = companionDecision({ ...c, x: 150 }, { px: 100, facing: 1, slot: 0, enemies: [{ x: 170, y: 262 }] }, 0.1);
  assert.equal(attack.attack, true);
});

test('fixed-RNG spawn planning is deterministic', () => {
  const comp = levelComposition(2, 2);
  const a = planMobSpawns(comp, 2, 2, fixedRng([0.3, 0.6, 0.1]));
  const b = planMobSpawns(comp, 2, 2, fixedRng([0.3, 0.6, 0.1]));
  assert.deepEqual(a.map((s) => s.x), b.map((s) => s.x));
});
