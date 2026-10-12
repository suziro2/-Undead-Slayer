// Hero collection: owned/locked heroes, team selection, unlocks, ascension and stat points.
import { HEROES, HERO_IDS, UPGRADE, ASCEND, MAX_TEAM } from '../../shared/data.js';
import { panel, button, portrait, rarityColor, COLORS } from '../ui.js';
import { PageScene } from './page.js';
import { post, put } from '../api.js';

export class CollectionScene extends PageScene {
  constructor() { super('Collection', 'COLLECTION', 'Pick your lead hero and team'); }

  create(data) {
    this.selected = this.selected || data?.heroId || null;
    super.create(data);
  }

  draw(s) {
    const owned = HERO_IDS.filter((id) => s.heroes[id].owned).length;
    this.label(330, 14, `OWNED ${owned}/10`, 6, COLORS.dim, { originX: 1 });
    HERO_IDS.forEach((id, i) => {
      const h = s.heroes[id];
      const y = 46 + i * 27;
      const isSel = this.selected === id;
      button(this, 8, y, 226, 24, '', () => { this.selected = id; this.render(); }, {
        fill: isSel ? 0x3a4a80 : 0x1d2444, edge: isSel ? COLORS.accent : 0x3d4a7a,
      });
      this.label(16, y + 8, HEROES[id].name.toUpperCase(), 7, h.owned ? COLORS.text : '#6d7388');
      this.label(112, y + 8, HEROES[id].rarity.toUpperCase(), 5, rarityColor(HEROES[id].rarity));
      const status = !h.owned ? 'LOCKED' : s.player.selectedHero === id ? 'LEAD' : s.player.team.includes(id) ? 'TEAM' : `LV${h.level}`;
      this.label(196, y + 8, status, 5, h.owned ? COLORS.good : COLORS.bad);
    });

    const id = this.selected || s.player.selectedHero;
    const hero = HEROES[id];
    const h = s.heroes[id];
    panel(this, 242, 46, 390, 276);
    portrait(this, 254, 56, id, 2, !h.owned);
    this.label(386, 56, hero.name.toUpperCase(), 11, COLORS.accent);
    this.label(386, 76, hero.title, 6, COLORS.dim);
    this.label(386, 92, `${hero.rarity.toUpperCase()}  ${hero.weapon}`, 5, rarityColor(hero.rarity));
    this.label(386, 108, `LV ${h.level}  XP ${h.xpIntoLevel}/${h.xpToNext || 'MAX'}`, 6);
    this.label(386, 122, `ASCEND ${h.ascension}/${ASCEND.max}  FRAG ${h.fragments}`, 6, COLORS.mana);
    this.label(254, 156, hero.description, 5, COLORS.text, { wordWrap: { width: 360 } });
    this.label(254, 186, `HP ${h.stats.maxHp}   ATK ${h.stats.atk}   DEF ${h.stats.def}`, 7, COLORS.good);
    this.label(254, 204, `SKILL ${hero.skill.name} LV${h.stats.skillLevel}/${UPGRADE.skill.max}`, 6, COLORS.accent);
    this.label(254, 218, hero.skill.desc, 5, COLORS.dim, { wordWrap: { width: 370 } });
    this.label(254, 244, `UNLOCK: ${hero.unlock.text}`, 5, h.owned ? COLORS.good : COLORS.dim, { wordWrap: { width: 370 } });
    this.label(254, 262, `STAT POINTS: ${s.player.statPoints}`, 6, COLORS.xp);

    const row = (i) => 280 + Math.floor(i / 3) * 28;
    const btn = (i, label, fn, opts) => button(this, 254 + (i % 3) * 124, row(i), 116, 22, label, fn, { size: 6, ...opts });
    let slot = 0;
    if (!h.owned) {
      if (hero.unlock.type === 'coins') btn(slot++, `BUY ${hero.unlock.cost}C`, () => this.act(`/api/heroes/${id}/unlock`, null, 'Hero unlocked!'), { enabled: s.player.coins >= hero.unlock.cost });
      else if (hero.unlock.type === 'fragments' || hero.unlock.type === 'gacha') {
        const cost = hero.unlock.cost;
        btn(slot++, `${cost} FRAG`, () => this.act(`/api/heroes/${id}/unlock`, null, 'Hero unlocked!'), { enabled: h.fragments >= cost });
      }
    } else {
      if (s.player.selectedHero !== id) btn(slot++, 'SET LEAD', () => this.setTeam(id, s.player.team.filter((t) => t !== id)), {});
      if (s.player.selectedHero !== id) {
        const inTeam = s.player.team.includes(id);
        const full = !inTeam && s.player.team.length >= MAX_TEAM - 1;
        btn(slot++, inTeam ? 'REMOVE TEAM' : full ? 'TEAM FULL' : 'ADD TEAM', () => {
          const team = inTeam ? s.player.team.filter((t) => t !== id) : [...s.player.team, id];
          this.setTeam(s.player.selectedHero, team);
        }, { enabled: !full || inTeam });
      }
      if (h.ascension < ASCEND.max) btn(slot++, `ASCEND ${ASCEND.fragments}F`, () => this.act(`/api/heroes/${id}/ascend`, null, 'Ascended!'), { enabled: h.fragments >= ASCEND.fragments });
      if (s.player.statPoints > 0) {
        ['hp', 'atk', 'def'].forEach((stat) => btn(slot++, `+${stat.toUpperCase()} POINT`, () => this.act(`/api/heroes/${id}/allocate`, { stat }, `+1 ${stat.toUpperCase()} point`)));
      }
    }
    this.label(254, 318, `Team: ${[s.player.selectedHero, ...s.player.team].map((t) => HEROES[t].name).join(', ')}`, 5, COLORS.dim);
  }

  async setTeam(lead, team) {
    const res = await this.run(put('/api/team', { selectedHero: lead, team }), 'Team updated');
    if (res) this.render();
  }

  async act(url, body, okMsg) {
    await this.run(post(url, body ?? {}), okMsg);
  }
}
