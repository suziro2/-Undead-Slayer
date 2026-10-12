// Hero upgrades: stat tiers (coins + Iron Ore), skill tiers (coins + Rune Shards),
// ascension (fragments) and free stat points from player level-ups.
import { HEROES, HERO_IDS, UPGRADE, ASCEND } from '../../shared/data.js';
import { tierCost } from '../../shared/rules.js';
import { panel, button, COLORS } from '../ui.js';
import { PageScene } from './page.js';
import { post } from '../api.js';

export class UpgradesScene extends PageScene {
  constructor() { super('Upgrades', 'UPGRADES', 'Spend coins, Iron Ore and Rune Shards'); }

  create(data) {
    this.selected = this.selected || data?.heroId || null;
    super.create(data);
  }

  draw(s) {
    const owned = HERO_IDS.filter((id) => s.heroes[id].owned);
    if (!this.selected || !s.heroes[this.selected]?.owned) this.selected = owned[0] || null;
    HERO_IDS.forEach((id, i) => {
      const o = s.heroes[id].owned;
      button(this, 8 + i * 63, 46, 58, 22, HEROES[id].name.slice(0, 6).toUpperCase(), () => { this.selected = id; this.render(); }, {
        size: 5, enabled: o, fill: this.selected === id ? 0x3a4a80 : 0x222a4a,
      });
    });
    if (!this.selected) { this.label(20, 100, 'Summon or unlock a hero first.', 7, COLORS.dim); return; }
    const id = this.selected;
    const h = s.heroes[id];
    const hero = HEROES[id];
    panel(this, 8, 76, 624, 242);
    this.label(20, 88, `${hero.name.toUpperCase()}  LV ${h.level}`, 9, COLORS.accent);
    this.label(20, 106, `HP ${h.stats.maxHp}  ATK ${h.stats.atk}  DEF ${h.stats.def}  SKILL LV${h.stats.skillLevel}`, 6);
    this.label(20, 120, `ASCENSION ${h.ascension}/${ASCEND.max}   FRAGMENTS ${h.fragments}`, 6, COLORS.mana);
    button(this, 440, 112, 184, 20, `ASCEND (${ASCEND.fragments} FRAG)`, () => this.act(`/api/heroes/${id}/ascend`, {}, 'Ascended! +8% stats'), {
      size: 5, enabled: h.ascension < ASCEND.max && h.fragments >= ASCEND.fragments,
    });
    this.label(20, 140, `FREE STAT POINTS: ${s.player.statPoints}  (allocate: +8 HP / +2 ATK / +2 DEF)`, 6, COLORS.xp);

    const stats = [
      ['hp', 'VITALITY', `+${UPGRADE.hp.perTier} max HP per tier`, h.upgrades.hp, UPGRADE.hp.max],
      ['atk', 'POWER', `+${UPGRADE.atk.perTier} ATK per tier`, h.upgrades.atk, UPGRADE.atk.max],
      ['def', 'GUARD', `+${UPGRADE.def.perTier} DEF per tier`, h.upgrades.def, UPGRADE.def.max],
      ['skill', 'SKILL', '+20% skill damage per level', h.upgrades.skill, UPGRADE.skill.max],
    ];
    stats.forEach(([stat, label, desc, tier, max], i) => {
      const y = 160 + i * 46;
      panel(this, 16, y, 608, 40, { fill: 0x0f1427 });
      this.label(26, y + 8, `${label}  ${tier}/${max}`, 7, COLORS.text);
      this.label(26, y + 24, desc, 5, COLORS.dim);
      const maxed = tier >= max;
      if (maxed) {
        this.label(440, y + 14, 'MAX TIER', 6, COLORS.good);
        return;
      }
      const c = tierCost(stat, tier);
      const parts = [`${c.coins} COIN`];
      if (c.ore) parts.push(`${c.ore} ORE`);
      if (c.shards) parts.push(`${c.shards} SHARD`);
      const affordable = s.player.coins >= c.coins
        && (c.ore === 0 || (s.materials.iron_ore || 0) >= c.ore)
        && (c.shards === 0 || (s.materials.rune_shard || 0) >= c.shards);
      this.label(300, y + 14, parts.join('  '), 5, affordable ? COLORS.text : COLORS.bad);
      button(this, 500, y + 10, 112, 22, 'UPGRADE', () => this.act(`/api/heroes/${id}/upgrade`, { stat }, `${label} upgraded`), {
        size: 6, enabled: affordable,
      });
    });
    this.label(16, 350 - 4, `IRON ORE ${s.materials.iron_ore || 0}   RUNE SHARDS ${s.materials.rune_shard || 0}`, 5, COLORS.dim);
    const pts = ['hp', 'atk', 'def'];
    pts.forEach((stat, i) => {
      button(this, 360 + i * 88, 304, 82, 20, `+${stat.toUpperCase()} PT`, () => this.act(`/api/heroes/${id}/allocate`, { stat }, `+1 ${stat.toUpperCase()} point`), {
        size: 5, enabled: s.player.statPoints > 0,
      });
    });
  }

  async act(url, body, okMsg) {
    await this.run(post(url, body), okMsg);
  }
}
