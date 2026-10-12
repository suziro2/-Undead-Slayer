// Battle scene: side-view arena with parallax, hero + AI companions, mobs/elite/boss,
// telegraphed boss attacks, minion summons at 66% and 33% HP, HUD, desktop and touch input.
// The client simulates combat; the server validates the kill report and computes rewards.
import { CHAPTERS, BOSSES, ENEMIES, HEROES, BOSS_LEVEL, POTIONS, GACHA } from '../../shared/data.js';
import { enemyScale } from '../../shared/rules.js';
import {
  MAP_W, FOOT_MIN, FOOT_MAX, MELEE_DY, clamp, damage, planMobSpawns, enemyStats, bossStats, bossPhase,
  enemyDecision, bossDecision, companionDecision,
} from '../systems/battle-core.js';
import { sheetKey, animKey, animDuration } from '../systems/assets.js';
import { audio } from '../systems/audio.js';
import { button, text, panel, bar, COLORS } from '../ui.js';
import { post } from '../api.js';
import { session } from '../session.js';

const SPECIAL_COST = 25;
const MANA_REGEN = 4;
const RANGED_STYLES = { bow: 320, fire: 240, nature: 260, storm: 330 };
const STYLE_MULT = { sword: 1, bow: 0.9, berserk: 1.1, fire: 0.95, dagger: 0.85, guard: 0.9, nature: 0.85, dark: 1, storm: 0.95, dragon: 1.1 };
const ANIM_HIT_AT = 0.45;

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.params = data;
  }

  create() {
    const { battle, chapter, level } = this.params;
    this.battle = battle;
    this.chapterId = chapter;
    this.level = level;
    this.chapterDef = CHAPTERS.find((c) => c.id === chapter);
    this.isBoss = level === BOSS_LEVEL;
    this.elapsed = 0;
    this.ending = false;
    this.paused = false;
    this.projectiles = [];
    this.telegraphs = [];
    this.fxList = [];
    this.kills = {};
    this.potionsUsed = { health_potion: 0, greater_potion: 0 };
    this.potionsLeft = { ...(battle.potions || {}) };
    this.potionCd = 0;
    this.coinPreview = 0;
    this.xpPreview = 0;
    this.spawnedTotal = 0;
    this.deadMobs = 0;
    this.pendingSpawns = [];
    this.joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0 };
    this.cameras.main.setBackgroundColor(0x0b0d18);

    this.buildBackground();
    this.buildActors();
    this.buildHud();
    this.buildInput();

    const lead = this.heroes[0];
    this.cameras.main.setBounds(0, 0, MAP_W, 360);
    this.cameras.main.startFollow(lead.sprite, true, 0.12, 0.12);
    this.cameras.main.setFollowOffset(0, 0);
    audio.playMusic(this.isBoss ? 'boss' : 'field');
    this.events.once('shutdown', () => this.cleanupInput());
  }

  // ---------------------------------------------------------------- setup
  buildBackground() {
    const env = this.chapterDef.env;
    const far = this.textures.exists(`bg-${env}-far`) ? `bg-${env}-far` : null;
    const mid = this.textures.exists(`bg-${env}-mid`) ? `bg-${env}-mid` : null;
    const ground = this.textures.exists(`bg-${env}-ground`) ? `bg-${env}-ground` : null;
    this.bgFar = far ? this.add.tileSprite(0, 0, 640, 240, far).setOrigin(0, 0).setScrollFactor(0).setDepth(-30) : null;
    this.bgMid = mid ? this.add.tileSprite(0, 0, 640, 240, mid).setOrigin(0, 0).setScrollFactor(0).setDepth(-20) : null;
    this.bgGround = ground ? this.add.tileSprite(0, 236, 640, 124, ground).setOrigin(0, 0).setScrollFactor(0).setDepth(-10) : null;
    this.bgFallback = this.add.graphics().fillStyle(0x1a1d33, 1).fillRect(0, 0, 640, 360).setScrollFactor(0).setDepth(-40);
    this.fx = this.add.graphics().setDepth(400);
  }

  makeSprite(kind, id, x, y, scale = 2) {
    const key = sheetKey(kind, id);
    const sprite = this.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(scale);
    sprite.play(animKey(kind, id, 'idle'));
    return sprite;
  }

  buildActors() {
    this.heroes = this.battle.heroes.map((h, i) => {
      const x = 90 + i * 10;
      const sprite = this.makeSprite('hero', h.id, x, 270, 2);
      const spec = HEROES[h.id];
      return {
        kind: 'hero', role: 'hero', id: h.id, name: spec.name, style: h.style, sprite, x, y: 270, facing: 1,
        hp: h.maxHp, maxHp: h.maxHp, atk: h.atk, def: h.def, speed: h.speed, range: h.range,
        mana: h.mana, maxMana: h.mana, skillMult: h.skillMult, skillCooldown: h.skillCooldown, skillCd: 0,
        lock: 0, attackDur: 0, attackElapsed: 0, combo: 0, queued: false, hitDone: true, hitAt: 0,
        dodgeT: 0, iframes: 0, shield: 0, dead: false, respawn: 0, isLead: i === 0, cd: 0, anim: '',
        index: i, mult: 1, xp: 0,
      };
    });
    this.lead = this.heroes[0];
    this.enemies = [];
    const plan = planMobSpawns(this.battle.composition, this.chapterId, this.level);
    if (!this.isBoss) {
      for (const spec of plan) this.spawnEnemy(spec);
      this.spawnedTotal = plan.length;
    } else {
      this.boss = this.spawnBoss();
    }
    this.buildLevelDepth();
  }

  buildLevelDepth() {
    this.heroes.forEach((h) => h.sprite.setDepth(h.y));
  }

  spawnEnemy(spec, { minion = false, x, y } = {}) {
    const px = x ?? spec.x;
    const py = y ?? spec.y;
    const sprite = this.makeSprite('mob', spec.type, px, py, 2);
    if (spec.elite) sprite.setTint(0xffd27a);
    const e = {
      ...spec, role: 'mob', id: spec.type, sprite, x: px, y: py, hp: spec.maxHp, facing: -1, dead: false, stun: 0, lock: 0,
      cd: 0.5, spCd: 2, awake: minion, minion, key: spec.key || spec.type, anim: '', special: spec.special,
    };
    this.enemies.push(e);
    return e;
  }

  spawnBoss() {
    const bossId = this.battle.boss.id;
    const stats = bossStats(bossId, this.chapterId);
    const sprite = this.makeSprite('boss', bossId, 1330, 270, 2);
    sprite.setDepth(270);
    return {
      ...stats, role: 'boss', sprite, x: 1330, y: 270, hp: stats.maxHp, phase: 0, busy: false, busyT: 0, active: false,
      cds: {}, facing: -1, invuln: 0, dead: false, defeatT: -1, minionCount: 0, anim: '',
    };
  }

  buildHud() {
    const L = (x, y, s, size = 6, color = COLORS.text, o = {}) => text(this, x, y, s, size, color, o).setScrollFactor(0).setDepth(500);
    const HB = (x, y, w, h, c) => { const b = bar(this, x, y, w, h, c); b.g.setScrollFactor(0).setDepth(495); return b; };
    this.hud = {};
    this.hudPanel = panel(this, 4, 4, 210, 74, { fill: 0x0b0d18, alpha: 0.85 }).setScrollFactor(0).setDepth(490);
    this.hudPortrait = this.add.image(8, 8, `portrait-${this.lead.id}`).setOrigin(0, 0).setScrollFactor(0).setDepth(495);
    this.hud.name = L(78, 8, HEROES[this.lead.id].name.toUpperCase(), 7, COLORS.accent);
    this.hud.level = L(150, 8, `LV ${this.battle.heroes[0].level}`, 5, COLORS.dim);
    this.hud.hpText = L(78, 22, '', 5);
    this.hud.hpBar = HB(78, 30, 124, 6, COLORS.hpBar);
    this.hud.manaBar = HB(78, 40, 124, 4, COLORS.mana);
    this.hud.xpBar = HB(78, 48, 124, 3, COLORS.xp);
    this.hud.manaText = L(78, 54, '', 5, COLORS.mana);
    this.hud.potionText = L(78, 64, '', 5, COLORS.good);
    this.companionHud = [];
    this.HB = HB;
    this.heroes.slice(1).forEach((h, i) => {
      const y = 84 + i * 14;
      const t = L(8, y, HEROES[h.id].name.toUpperCase(), 5, COLORS.text);
      const b = HB(62, y + 2, 80, 5, COLORS.good);
      this.companionHud.push({ t, b, h });
    });
    this.infoText = L(636, 8, '', 5, COLORS.text, { originX: 1 });
    this.hudRight = true;
    this.killText = L(636, 20, '', 5, COLORS.dim, { originX: 1 });
    this.rewardText = L(636, 32, '', 5, COLORS.accent, { originX: 1 });
    if (this.isBoss) {
      this.bossPanel = panel(this, 150, 4, 340, 34, { fill: 0x0b0d18, alpha: 0.85 }).setScrollFactor(0).setDepth(490);
      this.bossName = L(320, 8, '', 6, COLORS.bad, { originX: 0.5 });
      this.bossBar = HB(160, 22, 320, 8, COLORS.hpBar);
      this.bossMarks = this.add.graphics().setScrollFactor(0).setDepth(499);
      this.bossMarks.fillStyle(0xffffff, 0.9).fillRect(160 + 320 * 0.66, 21, 2, 10).fillRect(160 + 320 * 0.33, 21, 2, 10);
    }
    this.touchButtons = [
      button(this, 560, 300, 74, 22, 'ATTACK J', () => this.pressAttack(), { size: 5, fill: 0x7a2b2b }),
      button(this, 480, 300, 74, 22, 'DODGE K', () => this.pressDodge(), { size: 5, fill: 0x2a4a6a }),
      button(this, 560, 326, 74, 22, 'SPECIAL L', () => this.pressSpecial(), { size: 5, fill: 0x5a3a7a }),
      button(this, 480, 326, 74, 22, 'POTION Q', () => this.pressPotion(), { size: 5, fill: 0x2f6b3a }),
      button(this, 8, 330, 56, 22, 'PAUSE', () => this.togglePause(), { size: 5, fill: 0x2a3560 }),
    ];
    this.touchButtons.forEach((b) => b.container.setScrollFactor(0).setDepth(500));
    this.joyGfx = this.add.graphics().setScrollFactor(0).setDepth(499);
    this.pauseObjs = [];
  }

  buildInput() {
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,J,K,L,Q,ESC,P');
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.keys.J.on('down', () => this.pressAttack());
    this.keys.K.on('down', () => this.pressDodge());
    this.keys.SPACE.on('down', () => this.pressDodge());
    this.keys.L.on('down', () => this.pressSpecial());
    this.keys.Q.on('down', () => this.pressPotion());
    this.keys.ESC.on('down', () => this.togglePause());
    this.keys.P.on('down', () => this.togglePause());
    this.onPointerDown = (p) => {
      if (this.joy.active || this.paused || p.x > 300 || p.y < 60 || p.y > 300) return;
      this.joy = { active: true, id: p.id, ox: p.x, oy: p.y, dx: 0, dy: 0, mag: 0 };
    };
    this.onPointerMove = (p) => {
      if (!this.joy.active || p.id !== this.joy.id) return;
      const vx = p.x - this.joy.ox;
      const vy = p.y - this.joy.oy;
      const len = Math.hypot(vx, vy);
      const m = Math.min(1, len / 40);
      this.joy.dx = len ? (vx / len) * m : 0;
      this.joy.dy = len ? (vy / len) * m : 0;
      this.joy.mag = m;
    };
    this.onPointerUp = (p) => {
      if (this.joy.active && p.id === this.joy.id) this.joy.active = false;
    };
    this.input.on('pointerdown', this.onPointerDown);
    this.input.on('pointermove', this.onPointerMove);
    this.input.on('pointerup', this.onPointerUp);
    this.input.on('pointerupoutside', this.onPointerUp);
  }

  cleanupInput() {
    this.input.off('pointerdown', this.onPointerDown);
    this.input.off('pointermove', this.onPointerMove);
    this.input.off('pointerup', this.onPointerUp);
    this.input.off('pointerupoutside', this.onPointerUp);
    this.input.keyboard.removeCapture('UP,DOWN,LEFT,RIGHT,SPACE');
  }

  // ---------------------------------------------------------------- player input
  pressAttack() {
    if (this.paused || this.ending || this.lead.dead || this.lead.dodgeT > 0) return;
    const h = this.lead;
    if (h.lock > 0) {
      if (h.combo < 3 && h.attackElapsed >= h.attackDur * 0.3) h.queued = true;
      return;
    }
    this.startAttack(h, 1);
  }

  pressDodge() {
    if (this.paused || this.ending || this.lead.dead) return;
    const h = this.lead;
    if (h.dodgeT > 0 || (h.lock > 0 && h.combo === 0)) return;
    h.dodgeT = 0.3;
    h.iframes = 0.42;
    h.lock = 0.3;
    h.combo = 0;
    h.queued = false;
    this.playAnim(h, 'dodge', 0.3);
    audio.sfx('dodge');
  }

  pressSpecial() {
    if (this.paused || this.ending) return;
    this.useSpecial(this.lead);
  }

  pressPotion() {
    if (this.paused || this.ending || this.lead.dead || this.potionCd > 0) return;
    const h = this.lead;
    let id = null;
    if (h.hp < h.maxHp * 0.5 && this.potionsLeft.greater_potion > 0) id = 'greater_potion';
    else if (this.potionsLeft.health_potion > 0) id = 'health_potion';
    else if (this.potionsLeft.greater_potion > 0) id = 'greater_potion';
    if (!id) { this.floatText(h.x, h.y - 90, 'NO POTIONS', COLORS.bad); audio.sfx('error'); return; }
    this.potionsLeft[id] -= 1;
    this.potionsUsed[id] += 1;
    this.potionCd = POTIONS[id].cooldown;
    const heal = Math.round(h.maxHp * POTIONS[id].heal);
    const before = h.hp;
    h.hp = Math.min(h.maxHp, h.hp + heal); // never overheal
    this.floatText(h.x, h.y - 90, `+${h.hp - before}`, COLORS.good);
    this.fxRing(h.x, h.y - 30, 26, 0x7de07d, 0.4);
    audio.sfx('potion');
  }

  togglePause() {
    if (this.ending) return;
    if (this.paused) { this.hidePause(); return; }
    this.paused = true;
    const objs = [];
    objs.push(this.add.graphics().fillStyle(0x000000, 0.7).fillRect(0, 0, 640, 360).setScrollFactor(0).setDepth(600));
    objs.push(panel(this, 200, 100, 240, 160).setScrollFactor(0).setDepth(601));
    objs.push(text(this, 320, 116, 'PAUSED', 12, COLORS.accent, { originX: 0.5 }).setScrollFactor(0).setDepth(602));
    objs.push(text(this, 320, 140, `Level ${this.chapterId}-${this.level}  Kills ${this.totalKills()}`, 6, COLORS.dim, { originX: 0.5 }).setScrollFactor(0).setDepth(602));
    objs.push(button(this, 240, 166, 160, 26, 'RESUME', () => this.hidePause(), { size: 8 }).container.setScrollFactor(0).setDepth(602));
    objs.push(button(this, 240, 200, 160, 26, 'RETREAT', () => this.endBattle(false, true), { size: 8, fill: 0x5a2a2a }).container.setScrollFactor(0).setDepth(602));
    this.pauseObjs = objs;
    this.pauseOverlay = true;
  }

  hidePause() {
    this.paused = false;
    this.pauseObjs.forEach((o) => o.destroy());
    this.pauseObjs = [];
  }

  totalKills() {
    return Object.values(this.kills).reduce((a, b) => a + b, 0);
  }

  // ---------------------------------------------------------------- actions
  playAnim(actor, anim, lock = 0) {
    actor.anim = anim;
    actor.lock = lock;
    actor.sprite.play(animKey(actor.role, actor.id, anim), true);
  }

  startAttack(actor, stage) {
    const dur = stage === 3 ? 6 / 14 : 4 / 14;
    actor.combo = stage;
    actor.attackDur = dur + 0.12;
    actor.attackElapsed = 0;
    actor.hitDone = false;
    actor.hitAt = dur * 0.45;
    actor.queued = false;
    this.playAnim(actor, stage === 3 ? 'combo' : 'attack', actor.attackDur);
    audio.sfx('swing');
  }

  useSpecial(actor) {
    if (actor.dead || actor.lock > 0 || actor.skillCd > 0 || actor.mana < SPECIAL_COST) {
      if (actor.isLead && actor.mana < SPECIAL_COST) this.floatText(actor.x, actor.y - 90, 'NEED MANA', COLORS.mana);
      return false;
    }
    actor.mana -= SPECIAL_COST;
    actor.skillCd = actor.skillCooldown;
    this.playAnim(actor, 'special', 0.55);
    this.performSpecial(actor);
    return true;
  }

  // Enemies within a horizontal reach in front of the actor (or any direction when radius is given).
  enemiesIn(actor, reach, { dy = MELEE_DY + 8, behind = 8, circle = false } = {}) {
    const out = this.aliveEnemies();
    if (this.boss && !this.boss.dead) out.push(this.boss);
    return out.filter((e) => {
      const dx = e.x - actor.x;
      const dyy = Math.abs(e.y - actor.y);
      if (circle) return Math.hypot(dx, dyy) <= reach;
      return dx * actor.facing >= -behind && Math.abs(dx) <= reach && dyy <= dy;
    });
  }

  aliveEnemies() {
    return this.enemies.filter((e) => !e.dead);
  }

  performSpecial(actor) {
    const mult = actor.skillMult;
    const style = actor.style;
    audio.sfx(style === 'storm' || style === 'fire' || style === 'nature' ? 'magic' : 'swing');
    if (style === 'sword') {
      this.fxArc(actor.x, actor.y, actor.facing, 120, 0xfff3b0);
      this.enemiesIn(actor, 120, { dy: 34 }).forEach((e) => this.hitTarget(e, damage(actor.atk, e.def, mult), actor, true));
    } else if (style === 'bow') {
      [-0.2, 0, 0.2].forEach((spread) => this.spawnProjectile(actor, 360, spread, actor.atk * 0.6 * mult, 'hero'));
    } else if (style === 'berserk') {
      this.fxRing(actor.x, actor.y - 20, 74, 0xff6b4a, 0.35);
      this.enemiesIn(actor, 74, { circle: true, dy: 34 }).forEach((e) => this.hitTarget(e, damage(actor.atk, e.def, mult), actor, true));
    } else if (style === 'fire') {
      this.spawnProjectile(actor, 220, 0, actor.atk * mult, 'hero', { explode: 60, color: 0xff8a3d, big: true });
    } else if (style === 'dagger') {
      const target = this.aliveEnemies().filter((e) => Math.abs(e.x - actor.x) < 260).sort((a, b) => Math.abs(a.x - actor.x) - Math.abs(b.x - actor.x))[0];
      if (target) {
        actor.x = target.x - target.facing * 22;
        actor.sprite.x = actor.x;
        actor.facing = Math.sign(target.x - actor.x) || 1;
        actor.sprite.setFlipX(actor.facing < 0);
        this.hitTarget(target, damage(actor.atk, target.def, mult * 0.8), actor, true);
        this.time.delayedCall(180, () => { if (!target.dead) this.hitTarget(target, damage(actor.atk, target.def, mult * 0.8), actor, false); });
      }
    } else if (style === 'guard') {
      actor.shield = 4;
      this.fxRing(actor.x, actor.y - 20, 40, 0x9fd0ff, 0.6);
      this.enemiesIn(actor, 80, { circle: true, dy: 40 }).forEach((e) => this.hitTarget(e, damage(actor.atk, e.def, mult), actor, true));
      this.fxRing(actor.x, actor.y, 80, 0xc9a04a, 0.25);
    } else if (style === 'nature') {
      this.heal(actor, Math.round(actor.maxHp * 0.25));
      this.fxRing(actor.x, actor.y - 30, 90, 0x5ccc6a, 0.3);
      this.enemiesIn(actor, 90, { circle: true, dy: 40 }).forEach((e) => this.hitTarget(e, damage(actor.atk, e.def, mult), actor, true));
    } else if (style === 'dark') {
      this.fxRing(actor.x, actor.y, 80, 0x6b2a8a, 0.4);
      let dealt = 0;
      this.enemiesIn(actor, 80, { circle: true, dy: 30 }).forEach((e) => { dealt += this.hitTarget(e, damage(actor.atk, e.def, mult), actor, true); });
      if (dealt > 0) this.heal(actor, Math.round(dealt * 0.15));
    } else if (style === 'storm') {
      let from = { x: actor.x, y: actor.y - 20 };
      const hit = new Set();
      for (let i = 0; i < 3; i += 1) {
        const pool = this.aliveEnemies().filter((e) => !hit.has(e) && Math.hypot(e.x - from.x, e.y - from.y) < 220);
        if (!pool.length) break;
        pool.sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y));
        const t = pool[0];
        hit.add(t);
        this.fxLine(from.x, from.y, t.x, t.y - 20, 0x5ee0ff, 0.3);
        this.hitTarget(t, damage(actor.atk, t.def, mult), actor, true);
        from = { x: t.x, y: t.y - 20 };
      }
    } else if (style === 'dragon') {
      const fx = actor.facing;
      this.fxCone(actor.x, actor.y - 24, fx, 150, 0xff7a3d);
      this.enemiesIn(actor, 150, { dy: 40 }).forEach((e) => this.hitTarget(e, damage(actor.atk, e.def, mult), actor, true));
    }
  }

  // Basic attack hit for an actor at stage (1..3), using the style's shape.
  attackHit(actor, stage) {
    const mult = (stage === 3 ? 1.6 : 1) * (STYLE_MULT[actor.style] || 1);
    if (RANGED_STYLES[actor.style]) {
      this.spawnProjectile(actor, RANGED_STYLES[actor.style], 0, actor.atk * mult * 0.9, 'hero', {
        color: actor.style === 'storm' ? 0x5ee0ff : actor.style === 'fire' ? 0xff8a3d : actor.style === 'nature' ? 0x5ccc6a : 0xffffff,
        explode: actor.style === 'fire' ? 40 : 0,
      });
      return;
    }
    const reach = actor.range + (stage === 3 ? 14 : 0);
    const targets = this.enemiesIn(actor, reach, { dy: MELEE_DY + 6 });
    if (targets.length === 0) audio.sfx('swing');
    targets.forEach((e) => this.hitTarget(e, damage(actor.atk, e.def, mult), actor, stage === 3));
    if (stage === 3) this.fxArc(actor.x, actor.y, actor.facing, reach, 0xffd27a);
  }

  spawnProjectile(owner, speed, spread, dmg, side, extra = {}) {
    const dir = owner.facing ?? 1;
    const p = {
      x: owner.x + dir * 14, y: owner.y - 26, vx: dir * speed, vy: spread * speed * 0.6,
      dmg, owner: side, life: 2.2, explode: extra.explode || 0, color: extra.color || 0xffffff,
      big: !!extra.big, source: owner,
    };
    this.projectiles.push(p);
    audio.sfx('shot');
    return p;
  }

  // Applies player damage to an enemy or the boss. Returns damage dealt.
  hitTarget(target, dmg, source, big) {
    if (target.dead) return 0;
    if (target === this.boss) {
      if (this.boss.invuln > 0 || this.boss.dead) { this.floatText(target.x, target.y - 120, 'IMMUNE', COLORS.dim); return 0; }
      this.boss.hp = Math.max(0, this.boss.hp - dmg);
      this.floatText(target.x + (Math.random() * 20 - 10), target.y - 120, `${dmg}`, big ? COLORS.accent : COLORS.text);
      this.gainMana(source, 4);
      this.bossCheckPhase();
      audio.sfx('hit');
      if (this.boss.hp <= 0) this.bossDie();
      return dmg;
    }
    target.hp -= dmg;
    target.stun = 0.16;
    target.x += source.facing * 6;
    target.sprite.x = target.x;
    this.floatText(target.x, target.y - 70, `${dmg}`, big ? COLORS.accent : COLORS.text);
    this.gainMana(source, 4);
    audio.sfx('hit');
    if (target.hp <= 0) this.killEnemy(target);
    else if (target.lock <= 0) this.playAnim(target, 'hit', 0.16);
    return dmg;
  }

  gainMana(actor, n) {
    if (!actor || actor.kind !== 'hero') return;
    actor.mana = Math.min(actor.maxMana, actor.mana + n);
  }

  heal(actor, amount) {
    const before = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + amount);
    const got = actor.hp - before;
    if (got > 0) this.floatText(actor.x, actor.y - 90, `+${got}`, COLORS.good);
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    this.playAnim(e, 'defeat', 0.8);
    audio.sfx('death');
    if (!e.minion) {
      this.kills[e.key] = (this.kills[e.key] || 0) + 1;
      this.deadMobs += 1;
    } else {
      this.kills[e.key] = (this.kills[e.key] || 0) + 1;
    }
    this.coinPreview += e.coins;
    this.xpPreview += e.xp;
    this.floatText(e.x, e.y - 100, `+${e.coins} coins`, COLORS.accent);
    this.time.delayedCall(900, () => {
      this.tweens.add({ targets: e.sprite, alpha: 0, duration: 250, onComplete: () => e.sprite.destroy() });
    });
    if (!this.isBoss && this.deadMobs >= this.spawnedTotal) this.endBattle(true);
  }

  // Damage to a hero or companion (enemy attacks). Returns true when the hit landed.
  damageHero(h, raw) {
    if (h.dead) return false;
    if (h.dodgeT > 0 || h.iframes > 0) {
      this.floatText(h.x, h.y - 80, 'DODGE', COLORS.good);
      return false;
    }
    let dmg = raw;
    if (h.shield > 0) dmg = Math.max(1, Math.round(dmg * 0.4));
    h.hp = Math.max(0, h.hp - dmg);
    h.iframes = 0.35;
    this.floatText(h.x, h.y - 80, `-${dmg}`, COLORS.bad);
    audio.sfx('hurt');
    if (this.session_shake()) this.cameras.main.shake(120, 0.004);
    if (h.hp <= 0) {
      this.killHero(h);
    } else if (h.lock <= 0 || h.anim !== 'attack') {
      this.playAnim(h, 'hit', 0.2);
    }
    return true;
  }

  session_shake() {
    return session.state?.player.settings.screenShake !== false;
  }

  killHero(h) {
    h.dead = true;
    h.hp = 0;
    this.playAnim(h, 'defeat', 0.9);
    audio.sfx('death');
    if (h.isLead) {
      this.endBattle(false);
    } else {
      h.respawn = 15;
      h.sprite.setAlpha(0.6);
      this.floatText(h.x, h.y - 90, 'DOWN: 15s', COLORS.dim);
    }
  }

  // ---------------------------------------------------------------- boss
  bossCheckPhase() {
    const b = this.boss;
    if (!b || b.dead) return;
    const phase = bossPhase(b.hp / b.maxHp);
    if (phase > b.phase) {
      b.phase = phase;
      this.beginBossPhase(b);
    }
  }

  beginBossPhase(b) {
    b.busy = true;
    b.busyT = 1.3;
    b.invuln = 1.3;
    b.sprite.play(animKey('boss', b.id, 'phase'), true);
    this.fxRing(b.x, b.y - 60, 110, 0xff6b6b, 0.5);
    this.floatText(b.x, b.y - 150, 'ENRAGED!', COLORS.bad);
    audio.sfx('boss');
    this.cameras.main.shake(260, 0.01);
    // Summon minions: up to two per phase, capped so the level stays within the server's kill limit.
    const types = b.summons.slice(0, 2);
    const scale = enemyScale(this.chapterId, this.level, false);
    types.forEach((type, i) => {
      if (b.minionCount >= 6) return;
      const spec = enemyStats(type, scale);
      const x = clamp(b.x + (i === 0 ? -90 : 90), 40, MAP_W - 40);
      this.spawnEnemy(spec, { minion: true, x, y: 250 + i * 14 });
      b.minionCount += 1;
    });
  }

  startBossAttack(b, type) {
    const atk = b.attacks[type];
    const dir = b.facing;
    if (type === 'basic') {
      b.busy = true; b.busyT = 5 / 9;
      b.sprite.play(animKey('boss', b.id, 'basic'), true);
      this.time.delayedCall(ANIM_HIT_AT * 1000, () => {
        if (b.dead) return;
        this.bossMelee(b, atk.range, b.atk * atk.mult);
      });
    } else if (type === 'heavy') {
      b.busy = true; b.busyT = 6 / 7;
      b.sprite.play(animKey('boss', b.id, 'heavy'), true);
      const rect = { kind: 'rect', x: b.x + dir * (atk.range / 2), y: b.y - 20, w: atk.range, h: 42, t: 0.5, total: 0.5 };
      this.telegraphs.push({ ...rect, onDone: () => {
        if (!b.dead) this.bossArea(b, (h) => Math.abs(h.x - rect.x) < atk.range / 2 + 6 && Math.abs(h.y - b.y) < 36, b.atk * atk.mult);
      } });
    } else if (type === 'special') {
      b.busy = true; b.busyT = 6 / 7;
      b.sprite.play(animKey('boss', b.id, 'special'), true);
      this.time.delayedCall(ANIM_HIT_AT * 1000, () => {
        if (b.dead) return;
        const shots = atk.type === 'cone' ? [-0.25, 0, 0.25] : [0];
        shots.forEach((s) => this.bossProjectile(b, atk.speed || 170, s, b.atk * atk.mult * 0.8));
      });
    } else if (type === 'aoe') {
      b.busy = true; b.busyT = 6 / 7;
      b.sprite.play(animKey('boss', b.id, 'aoe'), true);
      const cx = b.x;
      const cy = b.y;
      this.telegraphs.push({ kind: 'circle', x: cx, y: cy, r: atk.radius, t: atk.telegraph, total: atk.telegraph, onDone: () => {
        if (!b.dead) this.bossArea(b, (h) => Math.hypot(h.x - cx, (h.y - cy) * 1.6) <= atk.radius, b.atk * atk.mult);
      } });
    }
    this.time.delayedCall(Math.max(0, b.busyT) * 1000, () => {
      if (b.dead) return;
      b.busy = false;
      if (!b.invuln) b.sprite.play(animKey('boss', b.id, 'idle'), true);
    });
  }

  bossMelee(b, range, dmg) {
    const targets = this.heroes.filter((h) => !h.dead && Math.abs(h.x - b.x) <= range + 16 && Math.abs(h.y - b.y) <= MELEE_DY + 8);
    targets.forEach((h) => this.damageHero(h, damage(dmg / 1, h.def, 1)));
    if (!targets.length) audio.sfx('swing');
  }

  bossArea(b, inside, rawDmg) {
    this.heroes.forEach((h) => {
      if (!h.dead && inside(h)) this.damageHero(h, damage(rawDmg, h.def, 1));
    });
    this.fxRing(b.x, b.y - 20, 60, 0xff6b6b, 0.3);
    this.cameras.main.shake(120, 0.006);
  }

  bossProjectile(b, speed, spread, rawDmg) {
    const target = this.lead;
    const dir = Math.sign(target.x - b.x) || -1;
    b.facing = dir;
    const p = {
      x: b.x + dir * 30, y: b.y - 60, vx: dir * speed, vy: spread * speed * 0.8 + (target.y - (b.y - 60)) * 0.6,
      dmg: rawDmg, owner: 'enemy', life: 2.4, explode: 0, color: 0x7fd8ff, big: true, source: b,
    };
    this.projectiles.push(p);
    audio.sfx('shot');
  }

  bossDie() {
    const b = this.boss;
    if (b.dead) return;
    b.dead = true;
    b.hp = 0;
    b.busy = true;
    b.sprite.play(animKey('boss', b.id, 'defeat'), true);
    audio.sfx('boss');
    this.floatText(b.x, b.y - 150, 'DEFEATED!', COLORS.accent);
    // The boss is reported through bossDefeated, not through the kill map.
    this.battleBossDefeated = true;
    this.time.delayedCall(1800, () => this.endBattle(true));
  }

  // ---------------------------------------------------------------- update loop
  update(time, delta) {
    if (this.paused || this.ending) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.elapsed += dt;
    this.updateCamera();
    this.updateHero(dt);
    this.updateCompanions(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateProjectiles(dt);
    this.updateTelegraphs(dt);
    this.updateFx(dt);
    this.potionCd = Math.max(0, this.potionCd - dt);
    this.heroes.forEach((h) => { h.mana = Math.min(h.maxMana, h.mana + MANA_REGEN * dt); h.skillCd = Math.max(0, h.skillCd - dt); });
    this.drawHud();
    this.heroes.forEach((h) => h.sprite.setDepth(h.y));
    this.enemies.forEach((e) => e.sprite && e.sprite.setDepth(e.y));
    if (this.boss) this.boss.sprite.setDepth(this.boss.y);
  }

  updateCamera() {
    const cam = this.cameras.main;
    if (this.bgFar) this.bgFar.tilePositionX = cam.scrollX * 0.25;
    if (this.bgMid) this.bgMid.tilePositionX = cam.scrollX * 0.5;
    if (this.bgGround) this.bgGround.tilePositionX = cam.scrollX;
  }

  updateHero(dt) {
    const h = this.lead;
    if (h.dead) {
      h.lock = Math.max(0, h.lock - dt);
      return;
    }
    h.iframes = Math.max(0, h.iframes - dt);
    h.shield = Math.max(0, h.shield - dt);
    if (h.dodgeT > 0) {
      h.dodgeT -= dt;
      h.x += h.facing * 240 * dt;
    }
    if (h.lock > 0) {
      h.lock -= dt;
      h.attackElapsed += dt;
      if (h.combo > 0 && !h.hitDone && h.attackElapsed >= h.hitAt) {
        h.hitDone = true;
        this.attackHit(h, h.combo);
      }
      if (h.lock <= 0) {
        if (h.queued && h.combo < 3) this.startAttack(h, h.combo + 1);
        else { h.combo = 0; h.queued = false; }
      }
    }
    if (h.lock <= 0 && h.dodgeT <= 0) {
      let mx = 0;
      let my = 0;
      const k = this.keys;
      if (k.A.isDown || k.LEFT.isDown) mx -= 1;
      if (k.D.isDown || k.RIGHT.isDown) mx += 1;
      if (k.W.isDown || k.UP.isDown) my -= 1;
      if (k.S.isDown || k.DOWN.isDown) my += 1;
      if (mx && my) { mx *= 0.7071; my *= 0.7071; }
      if (this.joy.active && this.joy.mag > 0.12) { mx = this.joy.dx; my = this.joy.dy; }
      const mag = Math.hypot(mx, my);
      const running = (k.SHIFT.isDown || (this.joy.active && this.joy.mag > 0.92)) && mag > 0.1;
      if (Math.abs(mx) > 0.15) { h.facing = mx > 0 ? 1 : -1; h.sprite.setFlipX(h.facing < 0); }
      const speed = h.speed * (running ? 1.8 : 1);
      h.x += mx * speed * dt;
      h.y += my * speed * 0.7 * dt;
      h.x = clamp(h.x, 20, MAP_W - 20);
      h.y = clamp(h.y, FOOT_MIN, FOOT_MAX);
      if (mag > 0.1) this.playAnim(h, running ? 'run' : 'walk', 0);
      else this.playAnim(h, 'idle', 0);
    }
    h.sprite.x = h.x;
    h.sprite.y = h.y;
    h.sprite.setAlpha(h.iframes > 0 && h.dodgeT <= 0 ? 0.7 : 1);
    this.potionCd = Math.max(0, this.potionCd);
  }

  updateCompanions(dt) {
    const lead = this.lead;
    const enemies = this.aliveEnemies().concat(this.boss && !this.boss.dead ? [this.boss] : []);
    for (const c of this.heroes.slice(1)) {
      if (c.dead) {
        c.respawn -= dt;
        if (c.respawn <= 0) {
          c.dead = false;
          c.hp = c.maxHp;
          c.x = lead.x - lead.facing * 40;
          c.y = lead.y;
          c.sprite.setAlpha(1);
          c.sprite.setVisible(true);
          this.playAnim(c, 'idle', 0);
        }
        continue;
      }
      c.iframes = Math.max(0, c.iframes - dt);
      c.shield = Math.max(0, c.shield - dt);
      if (c.lock > 0) {
        c.lock -= dt;
        c.attackElapsed += dt;
        if (c.combo > 0 && !c.hitDone && c.attackElapsed >= c.hitAt) { c.hitDone = true; this.attackHit(c, c.combo); }
        if (c.lock <= 0) { c.combo = 0; }
        c.sprite.x = c.x; c.sprite.y = c.y;
        continue;
      }
      const slot = c.index - 1;
      c.cd = Math.max(0, (c.cd || 0) - dt);
      const dec = companionDecision(
        { x: c.x, y: c.y, speed: c.speed * 0.95, range: c.range, mana: c.mana, specialCost: SPECIAL_COST, specialReady: c.skillCd <= 0, cd: c.cd, maxMana: c.maxMana },
        { px: lead.x, facing: lead.facing, slot, enemies: enemies.filter((e) => !e.dead).map((e) => ({ x: e.x, y: e.y })) },
        dt,
      );
      if (dec.attack) c.cd = 0.9;
      c.x += dec.vx * dt;
      c.x = clamp(c.x, 20, MAP_W - 20);
      if (dec.facing) { c.facing = dec.facing; c.sprite.setFlipX(c.facing < 0); }
      if (dec.special) this.useSpecial(c);
      else if (dec.attack) this.startAttack(c, 1);
      else this.playAnim(c, dec.vx ? 'walk' : 'idle', 0);
      c.y = clamp(c.y, FOOT_MIN, FOOT_MAX);
      c.sprite.x = c.x;
      c.sprite.y = c.y;
    }
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.stun > 0) { e.stun -= dt; continue; }
      if (e.lock > 0) {
        e.lock -= dt;
        e.attackElapsed = (e.attackElapsed || 0) + dt;
        if (e.pendingHit && e.attackElapsed >= e.pendingHitAt) { e.pendingHit(); e.pendingHit = null; }
        if (e.lock > 0) continue;
        e.anim = '';
      }
      if (e.lungeT > 0) {
        e.lungeT -= dt;
        e.x += e.facing * e.lungeSpeed * dt;
        this.meleeContact(e);
        e.sprite.x = e.x;
        continue;
      }
      if (e.minion === undefined) e.minion = false;
      const active = this.heroes.filter((h) => !h.dead);
      const target = active.reduce((best, h) => (!best || Math.abs(h.x - e.x) < Math.abs(best.x - e.x) ? h : best), null) || this.lead;
      const dec = enemyDecision(e, { px: target.x, py: target.y, dodging: target.dodgeT > 0 }, dt);
      e.x += dec.vx * dt;
      e.y = clamp(e.y + dec.vy * dt, FOOT_MIN, FOOT_MAX);
      e.x = clamp(e.x, 16, MAP_W - 16);
      if (dec.facing) { e.facing = dec.facing; e.sprite.setFlipX(e.facing < 0); }
      if (dec.melee) this.enemyAttack(e, target);
      else if (dec.special) this.enemySpecial(e, dec.special, target);
      else if (dec.moving) this.playAnim(e, 'move', 0);
      else this.playAnim(e, 'idle', 0);
      e.sprite.x = e.x;
      e.sprite.y = e.y;
    }
  }

  enemyAttack(e, target) {
    const isRanged = e.kind === 'ranged' || e.kind === 'flyer';
    this.playAnim(e, 'attack', 0.55);
    e.attackElapsed = 0;
    e.pendingHitAt = 0.36;
    e.pendingHit = () => {
      if (e.dead) return;
      if (isRanged) {
        this.enemyShot(e, target, 170, e.atk * 0.8);
      } else {
        const reach = e.range + 8;
        this.heroes.forEach((h) => {
          if (!h.dead && (h.x - e.x) * e.facing >= -6 && Math.abs(h.x - e.x) <= reach && Math.abs(h.y - e.y) <= MELEE_DY + 6) {
            this.damageHero(h, damage(e.atk, h.def, 1));
          }
        });
      }
    };
  }

  enemySpecial(e, type, target) {
    const sp = e.special || {};
    if (type === 'projectile') {
      this.playAnim(e, 'special', 0.45);
      e.attackElapsed = 0;
      e.pendingHitAt = 0.25;
      e.pendingHit = () => { if (!e.dead) this.enemyShot(e, target, sp.speed || 150, e.atk * 0.9); };
    } else if (type === 'lunge' || type === 'dash' || type === 'leap') {
      this.playAnim(e, 'special', 0.4);
      e.lungeT = type === 'leap' ? 0.28 : 0.35;
      e.lungeSpeed = type === 'leap' ? 260 : 210;
      e.lungeHit = false;
      e.facing = Math.sign(target.x - e.x) || 1;
    } else if (type === 'teleport') {
      this.playAnim(e, 'special', 0.4);
      e.attackElapsed = 0;
      e.pendingHitAt = 0.2;
      e.pendingHit = () => {
        if (e.dead) return;
        const side = target.facing >= 0 ? -1 : 1;
        e.x = clamp(target.x + side * 26, 16, MAP_W - 16);
        e.facing = Math.sign(target.x - e.x) || 1;
        e.sprite.x = e.x;
        this.fxRing(e.x, e.y - 20, 22, 0x7a5cff, 0.4);
        this.damageHero(target, damage(e.atk, target.def, 1));
      };
    } else if (type === 'aoe') {
      this.playAnim(e, 'special', 0.5);
      const cx = e.x;
      const cy = e.y;
      const radius = sp.radius || 46;
      this.telegraphs.push({ kind: 'circle', x: cx, y: cy, r: radius, t: 0.6, total: 0.6, onDone: () => {
        if (e.dead) return;
        this.fxRing(cx, cy, radius, 0xa0e0ff, 0.3);
        this.heroes.forEach((h) => { if (!h.dead && Math.hypot(h.x - cx, (h.y - cy) * 1.6) <= radius) this.damageHero(h, damage(e.atk, h.def, 1)); });
      } });
    }
  }

  enemyShot(e, target, speed, dmg) {
    const dir = Math.sign(target.x - e.x) || e.facing;
    this.projectiles.push({
      x: e.x + dir * 10, y: e.y - 22, vx: dir * speed, vy: (target.y - (e.y - 22)) * 0.5,
      dmg, owner: 'enemy', life: 2.4, explode: 0, color: e.elite ? 0xffd27a : 0xb0ffb0, big: false, source: e,
    });
    audio.sfx('shot');
  }

  meleeContact(e) {
    if (e.lungeHit) return;
    this.heroes.forEach((h) => {
      if (!h.dead && Math.abs(h.x - e.x) < 16 && Math.abs(h.y - e.y) < MELEE_DY) {
        e.lungeHit = true;
        this.damageHero(h, damage(e.atk, h.def, 1));
      }
    });
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b || b.dead) {
      return;
    }
    b.invuln = Math.max(0, b.invuln - dt);
    if (b.busy) {
      b.busyT -= dt;
      if (b.busyT <= 0) {
        b.busy = false;
        if (!b.invuln) b.sprite.play(animKey('boss', b.id, 'idle'), true);
      }
    }
    const lead = this.lead;
    const dec = bossDecision(b, { px: lead.x, py: lead.y }, dt);
    if (dec.facing) { b.facing = dec.facing; b.sprite.setFlipX(b.facing < 0); }
    if (!b.busy && dec.vx) {
      b.x = clamp(b.x + dec.vx * dt, 60, MAP_W - 60);
      b.sprite.play(animKey('boss', b.id, 'move'), true);
    } else if (!b.busy && b.active) {
      b.sprite.play(animKey('boss', b.id, 'idle'), true);
    }
    if (dec.attack && !b.busy) this.startBossAttack(b, dec.attack);
    b.sprite.x = b.x;
    b.sprite.y = b.y;
  }

  updateProjectiles(dt) {
    this.projectiles = this.projectiles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || p.x < -20 || p.x > MAP_W + 20) return false;
      if (p.owner === 'enemy') {
        const hit = this.heroes.find((h) => !h.dead && Math.abs(h.x - p.x) < 14 && Math.abs(h.y - 22 - p.y) < 22);
        if (hit) {
          this.damageHero(hit, damage(p.dmg, hit.def, 1));
          return false;
        }
        return true;
      }
      const targets = this.aliveEnemies();
      if (this.boss && !this.boss.dead) targets.push(this.boss);
      const hit = targets.find((e) => Math.abs(e.x - p.x) < (e === this.boss ? 40 : 14) && Math.abs(e.y - 24 - p.y) < (e === this.boss ? 60 : 18));
      if (hit) {
        if (p.explode) {
          const r = p.explode;
          this.fxRing(p.x, p.y, r, p.color, 0.35);
          this.enemiesIn({ x: p.x, y: p.y, facing: 1 }, r, { circle: true, dy: r }).forEach((e) => this.hitTarget(e, damage(p.dmg, e.def, 1), p.source, true));
        } else {
          this.hitTarget(hit, damage(p.dmg, hit.def ?? 0, 1), p.source, p.big);
        }
        return false;
      }
      return true;
    });
  }

  updateTelegraphs(dt) {
    this.telegraphs = this.telegraphs.filter((t) => {
      t.t -= dt;
      if (t.t <= 0) {
        t.onDone?.();
        return false;
      }
      return true;
    });
  }

  updateFx(dt) {
    this.fxList = this.fxList.filter((f) => { f.life -= dt; return f.life > 0; });
    this.fx.clear();
    for (const t of this.telegraphs) {
      const a = 0.25 + 0.35 * (1 - t.t / t.total);
      if (t.kind === 'rect') {
        this.fx.fillStyle(0xff3030, a).fillRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
        this.fx.lineStyle(1, 0xff6060, 0.9).strokeRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
      } else {
        this.fx.fillStyle(0xff3030, a * 0.6).fillEllipse(t.x, t.y, t.r * 2, t.r * 1.2);
        this.fx.lineStyle(1, 0xff6060, 0.9).strokeEllipse(t.x, t.y, t.r * 2, t.r * 1.2);
      }
    }
    for (const f of this.fxList) {
      const k = f.life / f.max;
      if (f.kind === 'ring') this.fx.lineStyle(2, f.color, k).strokeCircle(f.x, f.y, f.r * (1.2 - 0.2 * k));
      else if (f.kind === 'line') this.fx.lineStyle(2, f.color, k).lineBetween(f.x, f.y, f.x2, f.y2);
      else if (f.kind === 'arc') this.fx.lineStyle(3, f.color, k).beginPath().arc(f.x, f.y - 16, f.r, f.a0, f.a1, false).strokePath();
      else if (f.kind === 'cone') this.fx.fillStyle(f.color, k * 0.5).fillTriangle(f.x, f.y, f.x + f.dir * f.r, f.y - 34, f.x + f.dir * f.r, f.y + 34);
    }
    for (const p of this.projectiles) {
      this.fx.fillStyle(p.color, 1).fillRect(p.x - (p.big ? 5 : 3), p.y - (p.big ? 5 : 2), p.big ? 10 : 6, p.big ? 10 : 4);
      this.fx.fillStyle(0xffffff, 0.9).fillRect(p.x - 1, p.y - 1, 2, 2);
    }
  }

  fxRing(x, y, r, color, life) { this.fxList.push({ kind: 'ring', x, y, r, color, life, max: life }); }
  fxArc(x, y, dir, r, color) {
    const a0 = dir > 0 ? -1.1 : Math.PI - 1.1;
    this.fxList.push({ kind: 'arc', x, y, r, color, a0, a1: a0 + 2.2, life: 0.2, max: 0.2 });
  }
  fxLine(x, y, x2, y2, color, life) { this.fxList.push({ kind: 'line', x, y, x2, y2, color, life, max: life }); }
  fxCone(x, y, dir, r, color) { this.fxList.push({ kind: 'cone', x, y, dir, r, color, life: 0.35, max: 0.35 }); }

  floatText(x, y, str, color) {
    if (session.state && session.state.player.settings.showDamageNumbers === false && /^-?\d+$/.test(str)) return;
    const t = this.add.text(x, y, str, { fontFamily: 'PressStart2P', fontSize: '8px', color: typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color })
      .setOrigin(0.5, 1).setDepth(450).setResolution(1);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 800, ease: 'Quad.Out', onComplete: () => t.destroy() });
  }

  drawHud() {
    const h = this.lead;
    const cur = Math.max(0, h.hp);
    this.hud.hpBar.set(cur / h.maxHp, cur / h.maxHp > 0.3 ? COLORS.hpBar : 0xff3030);
    this.hud.manaBar.set(h.mana / h.maxMana);
    const hero = this.battle.heroes[0];
    this.hud.xpBar.set(hero.xpToNext ? hero.xpIntoLevel / hero.xpToNext : 1, COLORS.xp);
    this.hud.hpText.setText(`HP ${Math.ceil(cur)}/${h.maxHp}`);
    this.hud.manaText.setText(`MANA ${Math.floor(h.mana)}  SKILL ${h.skillCd > 0 ? Math.ceil(h.skillCd) + 's' : 'READY'}`);
    this.hud.potionText.setText(`POT H${this.potionsLeft.health_potion} G${this.potionsLeft.greater_potion}  CD ${this.potionCd > 0 ? Math.ceil(this.potionCd) : 0}`);
    this.companionHud.forEach(({ t, b, h: c }) => {
      const label = c.dead ? `${HEROES[c.id].name.toUpperCase()} (${Math.ceil(c.respawn)}s)` : HEROES[c.id].name.toUpperCase();
      t.setText(label);
      b.set(c.dead ? 0 : c.hp / c.maxHp, c.hp / c.maxHp > 0.3 ? COLORS.good : COLORS.bad);
    });
    const alive = this.aliveEnemies().length;
    this.infoText.setText(`${this.chapterDef.name.toUpperCase()}  L${this.level}`);
    this.killText.setText(this.isBoss ? `MINIONS LEFT ${alive}` : `KILLS ${this.deadMobs}/${this.spawnedTotal}`);
    this.rewardText.setText(`COINS ~${this.coinPreview}`);
    if (this.isBoss && this.boss) {
      const ratio = Math.max(0, this.boss.hp) / this.boss.maxHp;
      this.bossBar.set(ratio, ratio < 0.33 ? 0xff3030 : ratio < 0.66 ? 0xff9a3d : COLORS.hpBar);
      this.bossName.setText(`${this.boss.name.toUpperCase()}  PHASE ${this.boss.phase + 1}`);
    }
    this.drawJoystick();
  }

  drawJoystick() {
    this.joyGfx.clear();
    if (!this.joy.active) return;
    this.joyGfx.lineStyle(2, 0xffffff, 0.4).strokeCircle(this.joy.ox, this.joy.oy, 40);
    this.joyGfx.fillStyle(0xffffff, 0.35).fillCircle(this.joy.ox + this.joy.dx * 40, this.joy.oy + this.joy.dy * 40, 12);
  }

  // ---------------------------------------------------------------- end of battle
  endBattle(cleared, retreat = false) {
    if (this.ending) return;
    this.ending = true;
    this.paused = true;
    this.pendingResult = { cleared, retreat };
    if (cleared) {
      audio.sfx('win');
      if (this.lead && !this.lead.dead) this.playAnim(this.lead, 'victory', 0);
      this.time.delayedCall(900, () => this.finish(cleared, retreat));
    } else {
      audio.sfx(retreat ? 'click' : 'lose');
      this.time.delayedCall(retreat ? 0 : 1100, () => this.finish(false, retreat));
    }
  }

  async finish(cleared, retreat) {
    const potionsUsed = { ...this.potionsUsed };
    const payload = {
      battleId: this.battle.battleId,
      kills: { ...this.kills },
      potionsUsed,
      bossDefeated: !!this.battleBossDefeated,
      durationSec: Math.max(1, Math.round(this.elapsed)),
    };
    const label = text(this, 320, 176, 'SAVING RESULTS...', 9, COLORS.accent, { originX: 0.5 }).setScrollFactor(0).setDepth(700);
    this.add.graphics().fillStyle(0x000000, 0.6).fillRect(0, 0, 640, 360).setScrollFactor(0).setDepth(699);
    try {
      const result = await post('/api/battle/complete', payload);
      session.apply({ state: result.state });
      this.scene.start('Results', {
        result, cleared, retreat, chapter: this.chapterId, level: this.level, isBoss: this.isBoss,
        coinPreview: this.coinPreview, kills: payload.kills, elapsed: payload.durationSec,
      });
    } catch (err) {
      label.setText(`Could not save: ${err.message}`);
      label.setColor('#ff6b6b');
      this.add.text(320, 210, 'Press any key to return to Adventure', { fontFamily: 'PressStart2P', fontSize: '7px', color: '#8f9bc2' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(700);
      this.input.keyboard.once('keydown', () => this.scene.start('Adventure'));
    }
  }
}
