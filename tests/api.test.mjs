import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { CHAPTERS, GACHA, HEROES, BOSS_LEVEL } from '../shared/data.js';

let server;
let base;
let db;
const jars = new Map();

async function req(method, path, { body, cookie, raw, type } = {}) {
  const headers = {};
  if (body !== undefined || method !== 'GET') headers['Content-Type'] = type || 'application/json';
  const jar = cookie !== undefined ? cookie : jars.get('default');
  if (jar) headers.Cookie = jar;
  if (cookie === '') delete headers.Cookie;
  const res = await fetch(base + path, {
    method, headers,
    body: raw ?? (body !== undefined ? JSON.stringify(body) : (method === 'GET' ? undefined : '{}')),
  });
  const set = res.headers.get('set-cookie');
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, set };
}

function sessionFrom(set) {
  return set ? set.split(';')[0] : null;
}

const CREDS = { username: 'Tester_One', email: 'tester@example.com', password: 'secret123' };

before(async () => {
  db = openDb(':memory:');
  const app = createApp({ db, config: { cookieSecure: false, sessionDays: 14, trustProxy: false, rateLimitScale: 1000 } });
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((r) => server.close(r)));

test('static pages and vendored engine are served with relative, local URLs', async () => {
  const html = await fetch(base + '/');
  assert.equal(html.status, 200);
  const text = await html.text();
  assert.ok(text.includes('/vendor/phaser.js'));
  assert.ok(!/localhost|127\.0\.0\.1/.test(text), 'no localhost references in the page');
  assert.equal((await fetch(base + '/vendor/phaser.js')).status, 200);
  assert.equal((await fetch(base + '/vendor/press-start-2p.woff2')).status, 200);
  assert.equal((await fetch(base + '/assets/manifest.json')).status, 200);
  assert.equal((await fetch(base + '/shared/data.js')).status, 200);
  assert.equal((await fetch(base + '/assets/sprites/heroes/aiden.png')).status, 200);
});

test('protected endpoints reject anonymous requests', async () => {
  assert.equal((await req('GET', '/api/state', { cookie: '' })).status, 401);
  const anon = await req('GET', '/api/auth/me', { cookie: '' });
  assert.equal(anon.status, 200);
  assert.equal(anon.data.user, null, 'anonymous visitors get user: null');
});

test('registration validates input and enforces unique username and email case-insensitively', async () => {
  let r = await req('POST', '/api/auth/register', { body: { username: 'x', email: 'a@b.co', password: 'abc12345' }, cookie: '' });
  assert.equal(r.status, 400);
  assert.equal(r.data.field, 'username');
  r = await req('POST', '/api/auth/register', { body: { ...CREDS, password: 'nodigitsatall' }, cookie: '' });
  assert.equal(r.status, 400);
  assert.equal(r.data.field, 'password');
  r = await req('POST', '/api/auth/register', { body: { ...CREDS, email: 'bad' }, cookie: '' });
  assert.equal(r.data.field, 'email');
  r = await req('POST', '/api/auth/register', { raw: 'username=x', type: 'text/plain', cookie: '' });
  assert.equal(r.status, 415);
  r = await req('POST', '/api/auth/register', { raw: '{bad json', cookie: '' });
  assert.equal(r.status, 400);

  r = await req('POST', '/api/auth/register', { body: CREDS, cookie: '' });
  assert.equal(r.status, 201);
  assert.match(r.data.recoveryCode, /^[A-Z2-9-]{19}$/);
  assert.equal(r.data.state.player.coins, 500, 'starting coins');
  assert.equal(r.data.state.player.crystals, 60, 'starting crystals');
  assert.equal(r.data.state.heroes.aiden.owned, true);
  assert.equal(r.data.state.heroes.luna.owned, false);
  assert.ok(r.set && r.set.includes('HttpOnly') && r.set.includes('SameSite=Lax'));
  jars.set('default', sessionFrom(r.set));

  r = await req('POST', '/api/auth/register', { body: { ...CREDS, username: 'tester_one', email: 'other@example.com' }, cookie: '' });
  assert.equal(r.status, 400);
  assert.equal(r.data.field, 'username');
  r = await req('POST', '/api/auth/register', { body: { ...CREDS, username: 'other_user', email: 'TESTER@example.com' }, cookie: '' });
  assert.equal(r.data.field, 'email');
});

test('login is generic on failure, works case-insensitively, and returns saved progress', async () => {
  let r = await req('POST', '/api/auth/login', { body: { identifier: 'tester_one', password: 'wrong123' }, cookie: '' });
  assert.equal(r.status, 401);
  assert.equal(r.data.error, 'Invalid credentials');
  r = await req('POST', '/api/auth/login', { body: { identifier: 'nobody', password: 'whatever1' }, cookie: '' });
  assert.equal(r.data.error, 'Invalid credentials');
  r = await req('POST', '/api/auth/login', { body: { identifier: 'TESTER@example.com', password: CREDS.password }, cookie: '' });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.username, 'Tester_One');
  assert.equal(r.data.state.player.coins, 500);
});

test('session cookie grants access and logout invalidates it', async () => {
  const login = await req('POST', '/api/auth/login', { body: { identifier: 'Tester_One', password: CREDS.password }, cookie: '' });
  const cookie = sessionFrom(login.set);
  const me = await req('GET', '/api/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.username, 'Tester_One');
  const out = await req('POST', '/api/auth/logout', { cookie });
  assert.equal(out.status, 200);
  const gone = await req('GET', '/api/auth/me', { cookie });
  assert.equal(gone.data.user, null, 'session gone after logout');
  const again = await req('POST', '/api/auth/login', { body: { identifier: 'Tester_One', password: CREDS.password }, cookie: '' });
  jars.set('default', sessionFrom(again.set));
});

test('forgot password via recovery code resets the password and rotates the code', async () => {
  const reg = await req('POST', '/api/auth/register', { body: { username: 'Recover_Me', email: 'recover@example.com', password: 'firstpass1' }, cookie: '' });
  const code = reg.data.recoveryCode;
  let r = await req('POST', '/api/auth/forgot', { body: { identifier: 'recover@example.com', recoveryCode: 'AAAA-AAAA-AAAA-AAAA', newPassword: 'newpass123' }, cookie: '' });
  assert.equal(r.status, 400);
  r = await req('POST', '/api/auth/forgot', { body: { identifier: 'recover@example.com', recoveryCode: code.toLowerCase(), newPassword: 'short' }, cookie: '' });
  assert.equal(r.data.field, 'password');
  r = await req('POST', '/api/auth/forgot', { body: { identifier: 'Recover_Me', recoveryCode: code.toLowerCase(), newPassword: 'newpass123' }, cookie: '' });
  assert.equal(r.status, 200);
  assert.ok(r.data.recoveryCode && r.data.recoveryCode !== code, 'code rotated');
  r = await req('POST', '/api/auth/login', { body: { identifier: 'Recover_Me', password: 'firstpass1' }, cookie: '' });
  assert.equal(r.status, 401, 'old password rejected');
  r = await req('POST', '/api/auth/login', { body: { identifier: 'Recover_Me', password: 'newpass123' }, cookie: '' });
  assert.equal(r.status, 200);
  r = await req('POST', '/api/auth/forgot', { body: { identifier: 'Recover_Me', recoveryCode: code.replace(/-/g, ''), newPassword: 'another1' }, cookie: '' });
  assert.equal(r.status, 400, 'old recovery code no longer works');
});

test('state mutations are persisted: coins, summons, team and settings survive re-login', async () => {
  let r = await req('POST', '/api/gacha/summon', { body: { count: 1, currency: 'crystals' } });
  assert.equal(r.status, 200);
  const crystalsAfter = r.data.state.player.crystals;
  assert.equal(crystalsAfter, 50);
  r = await req('PUT', '/api/settings', { body: { musicVolume: 0.2, screenShake: false } });
  assert.equal(r.data.player.settings.musicVolume, 0.2);
  assert.equal(r.data.player.settings.screenShake, false);
  const again = await req('POST', '/api/auth/login', { body: { identifier: 'Tester_One', password: CREDS.password }, cookie: '' });
  jars.set('default', sessionFrom(again.set));
  const state = await req('GET', '/api/state');
  assert.equal(state.data.player.crystals, crystalsAfter, 'crystals restored');
  assert.equal(state.data.player.settings.musicVolume, 0.2, 'settings restored');
});

test('summons: cost checks, duplicates become fragments, history and pity are saved', async () => {
  let r = await req('POST', '/api/gacha/summon', { body: { count: 10, currency: 'coins' } });
  assert.equal(r.status, 400, 'not enough coins for ten pulls');
  // Grant currency directly in the test database to exercise the gacha volume.
  db.prepare('UPDATE players SET coins = 100000, crystals = 100000 WHERE user_id = (SELECT id FROM users WHERE username = ?)').run('Tester_One');
  const before = (await req('GET', '/api/state')).data;
  const results = [];
  for (let i = 0; i < 6; i += 1) {
    r = await req('POST', '/api/gacha/summon', { body: { count: 10, currency: 'coins' } });
    results.push(...r.data.results);
  }
  assert.equal(results.length, 60);
  // Pity invariant: the 10th pull without Epic+ is always Epic+ and flagged.
  let sinceEpic = 0;
  for (const res of results) {
    if (res.rarity === 'epic' || res.rarity === 'legendary') sinceEpic = 0;
    else sinceEpic += 1;
    if (sinceEpic >= GACHA.pity.epicAfter) assert.fail('pity should have triggered');
    if (res.pity) assert.ok(['epic', 'legendary'].includes(res.rarity));
    if (res.duplicate) assert.ok(res.fragments > 0);
    else assert.equal(res.fragments, 0);
  }
  const after = (await req('GET', '/api/state')).data;
  assert.equal(after.player.coins, before.player.coins - 6 * GACHA.multiCostCoins);
  assert.equal(after.player.stats.summons, before.player.stats.summons + 60);
  const history = await req('GET', '/api/gacha/history');
  assert.ok(history.data.history.length >= 50);
});

test('gacha summons are limited to single and ten pulls and to earned currencies', async () => {
  let r = await req('POST', '/api/gacha/summon', { body: { count: 5, currency: 'coins' } });
  assert.equal(r.status, 400);
  r = await req('POST', '/api/gacha/summon', { body: { count: 1, currency: 'cards' } });
  assert.equal(r.status, 400);
});

test('campaign: locked levels are refused and clearing unlocks the next level', async () => {
  let r = await req('POST', '/api/battle/start', { body: { chapter: 1, level: 2 } });
  assert.equal(r.status, 400);
  r = await req('POST', '/api/battle/start', { body: { chapter: 1, level: 1 } });
  assert.equal(r.status, 200);
  const battleId = r.data.battleId;
  r = await req('POST', '/api/battle/complete', { body: { battleId, kills: { zombie: 99 }, durationSec: 60 } });
  assert.equal(r.status, 400, 'too many kills rejected');
  r = await req('POST', '/api/battle/start', { body: { chapter: 1, level: 1 } });
  r = await req('POST', '/api/battle/complete', { body: { battleId: r.data.battleId, kills: { zombie: 1 }, bossDefeated: true, durationSec: 60 } });
  assert.equal(r.status, 400, 'boss flag only valid on boss levels');
  r = await req('POST', '/api/battle/start', { body: { chapter: 1, level: 1 } });
  const comp = r.data.composition.mobs;
  const kills = comp;
  r = await req('POST', '/api/battle/complete', { body: { battleId: r.data.battleId, kills, durationSec: 60, potionsUsed: { health_potion: 50 } } });
  assert.equal(r.status, 400, 'potion use must be cooldown-plausible');
  r = await req('POST', '/api/battle/start', { body: { chapter: 1, level: 1 } });
  r = await req('POST', '/api/battle/complete', { body: { battleId: r.data.battleId, kills, durationSec: 60, potionsUsed: { greater_potion: 9999 } } });
  assert.equal(r.status, 400, 'cannot use potions you do not own');
  r = await req('POST', '/api/battle/start', { body: { chapter: 1, level: 1 } });
  const before = (await req('GET', '/api/state')).data;
  assert.ok(before.player.coins > 0);
  r = await req('POST', '/api/battle/complete', { body: { battleId: r.data.battleId, kills, durationSec: 120 } });
  assert.equal(r.status, 200);
  assert.equal(r.data.cleared, true);
  assert.equal(r.data.firstClear, true);
  assert.ok(r.data.rewards.coins > 0 && r.data.rewards.xp > 0);
  assert.ok(r.data.state.player.coins > before.player.coins);
  assert.ok(r.data.state.campaign.completed.includes('1-1'));
  r = await req('POST', '/api/battle/start', { body: { chapter: 1, level: 2 } });
  assert.equal(r.status, 200, 'level 2 unlocked');
  r = await req('POST', '/api/battle/complete', { body: { battleId: 'nope', kills: {}, durationSec: 10 } });
  assert.equal(r.status, 404, 'unknown battle');
});

test('boss defeat grants the chest, unlocks the chapter and auto-unlocks the matching hero', async () => {
  const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('Tester_One').id;
  const ins = db.prepare('INSERT OR REPLACE INTO level_progress (user_id, chapter, level, clears, best_kills) VALUES (?, 3, ?, 1, 0)');
  for (let lv = 1; lv <= 4; lv += 1) ins.run(userId, lv);
  let r = await req('POST', '/api/battle/start', { body: { chapter: 3, level: BOSS_LEVEL } });
  assert.equal(r.status, 200);
  assert.equal(r.data.boss.id, 'frost_dragon');
  const itemsBefore = (await req('GET', '/api/state')).data.items.length;
  r = await req('POST', '/api/battle/complete', { body: { battleId: r.data.battleId, kills: {}, bossDefeated: true, durationSec: 300 } });
  assert.equal(r.status, 200);
  assert.equal(r.data.cleared, true);
  assert.ok(r.data.drops.chest, 'boss chest granted');
  assert.equal(r.data.drops.chest.items.length, 2);
  assert.equal(r.data.state.items.length, itemsBefore + 2);
  assert.ok(r.data.state.campaign.completed.includes('3-5'));
  assert.equal(r.data.state.heroes.bruno.owned, true, 'Bruno unlocked by defeating the Frost Dragon');
  assert.ok(r.data.state.player.stats.bossesDefeated >= 1);
  assert.equal(CHAPTERS[2].boss, 'frost_dragon');
  assert.ok(HEROES.bruno);
});

async function newUser(name, { coins = 0, crystals = 0 } = {}) {
  const r = await req('POST', '/api/auth/register', { body: { username: name, email: `${name.toLowerCase()}@example.com`, password: 'secret123' }, cookie: '' });
  assert.equal(r.status, 201);
  jars.set('default', sessionFrom(r.set));
  const id = db.prepare('SELECT id FROM users WHERE username = ?').get(name).id;
  db.prepare('UPDATE players SET coins = coins + ?, crystals = crystals + ? WHERE user_id = ?').run(coins, crystals, id);
  return id;
}

test('hero unlocks: coins and fragments are enforced; locked heroes cannot be upgraded', async () => {
  await newUser('Unlock_Test', { coins: 2500 });
  let r = await req('POST', '/api/heroes/luna/unlock', { body: {} });
  assert.equal(r.status, 200, 'luna costs 2500 coins');
  assert.equal(r.data.heroes.luna.owned, true);
  assert.equal(r.data.player.coins, 500, 'starting coins minus 2500 from 3000');
  r = await req('POST', '/api/heroes/mira/unlock', { body: {} });
  assert.equal(r.status, 400, 'mira needs 4000 coins');
  r = await req('POST', '/api/heroes/elian/unlock', { body: {} });
  assert.equal(r.status, 400, 'elian needs fragments');
  r = await req('POST', '/api/heroes/riven/upgrade', { body: { stat: 'hp' } });
  assert.equal(r.status, 400, 'not owned');
  r = await req('POST', '/api/heroes/aiden/upgrade', { body: { stat: 'hp' } });
  assert.equal(r.status, 400, 'no iron ore yet');
  db.prepare("UPDATE materials SET qty = 10 WHERE user_id = (SELECT id FROM users WHERE username = 'Unlock_Test') AND item_id = 'iron_ore'").run();
  r = await req('POST', '/api/heroes/aiden/upgrade', { body: { stat: 'hp' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.heroes.aiden.upgrades.hp, 1);
  const lv = r.data.heroes.aiden.level;
  assert.equal(r.data.heroes.aiden.stats.maxHp, HEROES.aiden.base.hp + HEROES.aiden.growth.hp * (lv - 1) + 10);
});

test('equipment: equip, displace in the same slot, unequip, dismantle protections', async () => {
  const userId = await newUser('Gear_Test');
  const insert = db.prepare("INSERT INTO items (user_id, template_id, slot, rarity, atk, def, hp) VALUES (?, 'test_blade', 'weapon', 'rare', 9, 0, 0)");
  const first = insert.run(userId).lastInsertRowid;
  const second = insert.run(userId).lastInsertRowid;
  let r = await req('POST', `/api/items/${first}/equip`, { body: { heroId: 'aiden' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.heroes.aiden.equipment.weapon, first);
  r = await req('POST', `/api/items/${second}/equip`, { body: { heroId: 'aiden' } });
  assert.equal(r.data.heroes.aiden.equipment.weapon, second, 'second weapon displaces first');
  r = await req('POST', `/api/items/${second}/dismantle`, { body: {} });
  assert.equal(r.status, 400, 'equipped items cannot be dismantled');
  r = await req('POST', `/api/items/${first}/dismantle`, { body: {} });
  assert.equal(r.status, 200);
  assert.ok(r.data.materials.iron_ore >= 2, 'rare dismantles to iron ore');
  r = await req('POST', `/api/items/${second}/unequip`, { body: {} });
  assert.equal(r.data.heroes.aiden.equipment.weapon, null);
  r = await req('POST', '/api/items/999999/equip', { body: { heroId: 'aiden' } });
  assert.equal(r.status, 404);
});

test('shop purchases spend coins and add potions', async () => {
  await newUser('Shop_Test', { coins: 1000 });
  const before = (await req('GET', '/api/state')).data;
  let r = await req('POST', '/api/shop/buy', { body: { itemId: 'health_potion' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.potions.health_potion, before.potions.health_potion + 1);
  assert.equal(r.data.player.coins, before.player.coins - 60);
  r = await req('POST', '/api/shop/buy', { body: { itemId: 'fake_item' } });
  assert.equal(r.status, 404);
  let refused = false;
  for (let i = 0; i < 60 && !refused; i += 1) {
    r = await req('POST', '/api/shop/buy', { body: { itemId: 'greater_potion' } });
    if (r.status === 400) refused = true;
  }
  assert.ok(refused, 'purchases stop when coins run out');
  assert.ok((await req('GET', '/api/state')).data.player.coins >= 0, 'never negative');
});

test('stat points from level-ups are required to allocate', async () => {
  await newUser('Points_Test');
  let r = await req('POST', '/api/heroes/aiden/allocate', { body: { stat: 'atk' } });
  assert.equal(r.status, 400, 'no stat points on a fresh account');
  r = await req('POST', '/api/heroes/aiden/allocate', { body: { stat: 'speed' } });
  assert.equal(r.status, 400, 'speed is not an allocatable stat');
});

test('profile: password change requires the current password and regenerates recovery codes', async () => {
  await newUser('Profile_Test');
  let r = await req('POST', '/api/profile/password', { body: { currentPassword: 'nope', newPassword: 'another9x' } });
  assert.equal(r.status, 400);
  r = await req('POST', '/api/profile/password', { body: { currentPassword: 'secret123', newPassword: 'changed99' } });
  assert.equal(r.status, 200);
  r = await req('POST', '/api/auth/login', { body: { identifier: 'Profile_Test', password: 'changed99' }, cookie: '' });
  assert.equal(r.status, 200);
  jars.set('default', sessionFrom(r.set));
  r = await req('POST', '/api/profile/recovery-code', { body: { password: 'wrong' } });
  assert.equal(r.status, 400);
  r = await req('POST', '/api/profile/recovery-code', { body: { password: 'changed99' } });
  assert.equal(r.status, 200);
  assert.match(r.data.recoveryCode, /^[A-Z2-9-]{19}$/);
});

test('settings reject non-numeric volumes and clamp the range', async () => {
  await newUser('Settings_Test');
  let r = await req('PUT', '/api/settings', { body: { musicVolume: 'loud' } });
  assert.equal(r.status, 400);
  r = await req('PUT', '/api/settings', { body: { musicVolume: 7 } });
  assert.equal(r.data.player.settings.musicVolume, 1);
});

test('team: only owned heroes, max three, and the lead must be owned', async () => {
  await newUser('Team_Test', { coins: 5000 });
  let r = await req('PUT', '/api/team', { body: { selectedHero: 'aiden', team: ['luna', 'bruno', 'mira', 'kael'] } });
  assert.equal(r.status, 400, 'too many companions');
  r = await req('PUT', '/api/team', { body: { selectedHero: 'mira', team: [] } });
  assert.equal(r.status, 400, 'mira not owned');
  r = await req('PUT', '/api/team', { body: { selectedHero: 'aiden', team: ['luna'] } });
  assert.equal(r.status, 400, 'luna not owned yet');
  assert.match(r.data.error, /not owned/);
  await req('POST', '/api/heroes/luna/unlock', { body: {} });
  r = await req('PUT', '/api/team', { body: { selectedHero: 'aiden', team: ['luna'] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.player.team, ['luna']);
});

test('battle start includes lead and companion stats', async () => {
  const r = await req('POST', '/api/battle/start', { body: { chapter: 1, level: 1 } });
  assert.equal(r.status, 200);
  assert.equal(r.data.heroes.length, 2);
  assert.equal(r.data.heroes[0].id, 'aiden');
  assert.ok(r.data.heroes.every((h) => h.maxHp > 0 && h.level >= 1 && h.xpToNext > 0));
  assert.equal(r.data.heroes[1].id, 'luna');
  await req('POST', '/api/battle/abort', { body: { battleId: r.data.battleId } });
});

test('partial battles still pay kill rewards but do not mark the level cleared', async () => {
  await newUser('Partial_Test');
  const r = await req('POST', '/api/battle/start', { body: { chapter: 1, level: 1 } });
  assert.equal(r.status, 200);
  const done = await req('POST', '/api/battle/complete', { body: { battleId: r.data.battleId, kills: { zombie: 1 }, durationSec: 40 } });
  assert.equal(done.status, 200);
  assert.equal(done.data.cleared, false);
  assert.equal(done.data.firstClear, false);
  assert.ok(done.data.rewards.coins > 0);
  assert.ok(!done.data.state.campaign.completed.includes('1-1'));
});

test('campaign: a boss defeat grants the chest, unlocks the chapter and the matching hero', async () => {
  const userId = await newUser('Boss_Test');
  const ins = db.prepare('INSERT OR REPLACE INTO level_progress (user_id, chapter, level, clears, best_kills) VALUES (?, 3, ?, 1, 0)');
  for (let lv = 1; lv <= 4; lv += 1) ins.run(userId, lv);
  let r = await req('POST', '/api/battle/start', { body: { chapter: 3, level: BOSS_LEVEL } });
  assert.equal(r.status, 200);
  assert.equal(r.data.boss.id, 'frost_dragon');
  assert.equal(r.data.composition.boss, 'frost_dragon');
  const before = (await req('GET', '/api/state')).data;
  assert.equal(before.heroes.bruno.owned, false);
  const itemsBefore = before.items.length;
  r = await req('POST', '/api/battle/complete', { body: { battleId: r.data.battleId, kills: {}, bossDefeated: true, durationSec: 300 } });
  assert.equal(r.status, 200);
  assert.equal(r.data.cleared, true);
  assert.ok(r.data.drops.chest, 'boss chest granted');
  assert.equal(r.data.drops.chest.items.length, 2);
  assert.equal(r.data.state.items.length, itemsBefore + 2);
  assert.ok(r.data.state.campaign.completed.includes('3-5'));
  assert.equal(r.data.state.heroes.bruno.owned, true, 'Bruno unlocked by defeating the Frost Dragon');
  assert.ok(r.data.state.player.stats.bossesDefeated >= 1);
  assert.equal(CHAPTERS[2].boss, 'frost_dragon');
  assert.ok(HEROES.bruno);
});

test('state is restored after logout and login', async () => {
  const r = await req('POST', '/api/auth/login', { body: { identifier: 'Boss_Test', password: 'secret123' }, cookie: '' });
  jars.set('default', sessionFrom(r.set));
  const state = (await req('GET', '/api/state')).data;
  assert.ok(state.campaign.completed.includes('3-5'));
  assert.equal(state.heroes.bruno.owned, true);
});

test('unknown routes return JSON 404 for the API', async () => {
  const r = await req('GET', '/api/does-not-exist');
  assert.equal(r.status, 404);
  assert.ok(r.data.error);
});

test('session cookie is SameSite=None; Secure over HTTPS so it works inside an embedded preview', async () => {
  const body = JSON.stringify({ identifier: 'Tester_One', password: 'secret123' });
  const headers = { 'Content-Type': 'application/json' };
  const plain = await fetch(base + '/api/auth/login', { method: 'POST', headers, body });
  assert.match(plain.headers.get('set-cookie') || '', /SameSite=Lax/);
  assert.doesNotMatch(plain.headers.get('set-cookie') || '', /; Secure/);
  const https = await fetch(base + '/api/auth/login', { method: 'POST', headers: { ...headers, 'X-Forwarded-Proto': 'https' }, body });
  assert.match(https.headers.get('set-cookie') || '', /SameSite=None; Secure/);
});

test('bearer token works without cookies (embedded previews) and logout revokes it', async () => {
  const login = await req('POST', '/api/auth/login', { body: { identifier: 'Tester_One', password: 'secret123' }, cookie: '' });
  assert.equal(login.status, 200);
  assert.ok(login.data.token && login.data.token.length >= 40, 'token returned for the client to keep');
  const auth = { Authorization: `Bearer ${login.data.token}` };
  const state = await fetch(base + '/api/state', { headers: auth });
  assert.equal(state.status, 200, 'state readable with only the Bearer header');
  const battle = await fetch(base + '/api/battle/start', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ chapter: 1, level: 1 }) });
  assert.equal(battle.status, 200, 'battle start works without a cookie');
  const out = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(out.status, 200);
  assert.equal((await fetch(base + '/api/state', { headers: auth })).status, 401, 'revoked after logout');
  const bad = await fetch(base + '/api/state', { headers: { Authorization: 'Bearer ' + 'x'.repeat(40) } });
  assert.equal(bad.status, 401, 'unknown token rejected');
});
