// Inventory: equipment (equip, unequip, dismantle into Iron Ore), potions, materials,
// and collection completion.
import { HEROES, HERO_IDS, WEAPON_TEMPLATES, ARMOR_TEMPLATES, POTIONS, MATERIALS, RARITIES } from '../../shared/data.js';
import { panel, button, paginate, rarityColor, COLORS } from '../ui.js';
import { PageScene } from './page.js';
import { post } from '../api.js';

const PER_PAGE = 7;

export class InventoryScene extends PageScene {
  constructor() { super('Inventory', 'INVENTORY', 'Equip gear, manage potions and materials'); }

  create(data) {
    this.page = 0;
    this.selectedUid = null;
    this.equipTarget = null;
    super.create(data);
  }

  draw(s) {
    const items = s.items;
    const pg = paginate(items, this.page, PER_PAGE);
    this.page = pg.page;
    panel(this, 8, 46, 340, 276);
    this.label(18, 54, `EQUIPMENT ${items.length}`, 6, COLORS.accent);
    pg.items.forEach((it, i) => {
      const y = 70 + i * 32;
      const sel = this.selectedUid === it.uid;
      button(this, 16, y, 324, 28, '', () => { this.selectedUid = it.uid; this.render(); }, {
        fill: sel ? 0x3a4a80 : 0x1d2444, edge: sel ? COLORS.accent : 0x3d4a7a,
      });
      this.label(24, y + 6, it.name.toUpperCase(), 6, rarityColor(it.rarity));
      this.label(24, y + 17, `${it.slot.toUpperCase()}  ${it.atk ? `ATK+${it.atk} ` : ''}${it.def ? `DEF+${it.def} ` : ''}${it.hp ? `HP+${it.hp}` : ''}`, 5, COLORS.dim);
      if (it.equippedBy) this.label(260, y + 12, `ON ${HEROES[it.equippedBy].name.toUpperCase()}`, 5, COLORS.good);
    });
    if (!items.length) this.label(20, 74, 'No equipment yet. Defeat enemies and bosses.', 6, COLORS.dim, { wordWrap: { width: 320 } });
    button(this, 16, 300, 90, 20, '< PREV', () => { this.page -= 1; this.render(); }, { size: 5, enabled: pg.page > 0 });
    button(this, 250, 300, 90, 20, 'NEXT >', () => { this.page += 1; this.render(); }, { size: 5, enabled: pg.page < pg.pages - 1 });
    this.label(150, 306, `${pg.page + 1}/${pg.pages}`, 6, COLORS.dim);

    panel(this, 356, 46, 276, 276);
    const it = items.find((x) => x.uid === this.selectedUid);
    if (!it) {
      this.label(368, 60, 'Select an item to see its stats.', 6, COLORS.dim, { wordWrap: { width: 250 } });
    } else {
      this.label(368, 60, it.name.toUpperCase(), 8, rarityColor(it.rarity));
      this.label(368, 76, `${it.rarity.toUpperCase()} ${it.slot.toUpperCase()}`, 6, rarityColor(it.rarity));
      this.label(368, 94, `ATK +${it.atk}   DEF +${it.def}   HP +${it.hp}`, 6, COLORS.text);
      this.label(368, 110, it.equippedBy ? `Equipped on ${HEROES[it.equippedBy].name}` : 'Not equipped', 5, it.equippedBy ? COLORS.good : COLORS.dim);
      const owned = HERO_IDS.filter((id) => s.heroes[id].owned);
      const target = owned.includes(this.equipTarget) ? this.equipTarget : (s.player.selectedHero);
      button(this, 368, 130, 252, 22, `EQUIP TO: ${HEROES[target].name.toUpperCase()}  (CHANGE)`, () => {
        const idx = owned.indexOf(target);
        this.equipTarget = owned[(idx + 1) % owned.length];
        this.render();
      }, { size: 5, fill: 0x3a2f5a });
      button(this, 368, 158, 122, 22, 'EQUIP', () => this.act(`/api/items/${it.uid}/equip`, { heroId: target }, 'Equipped'), {
        size: 6, enabled: it.equippedBy !== target,
      });
      button(this, 498, 158, 122, 22, 'UNEQUIP', () => this.act(`/api/items/${it.uid}/unequip`, {}, 'Unequipped'), {
        size: 6, enabled: !!it.equippedBy,
      });
      button(this, 368, 186, 252, 22, `DISMANTLE (+ORE)`, () => this.act(`/api/items/${it.uid}/dismantle`, {}, 'Dismantled'), {
        size: 6, enabled: !it.equippedBy, fill: 0x5a2a2a,
      });
      this.label(368, 214, 'Dismantle converts an unequipped item into Iron Ore:', 5, COLORS.dim);
      this.label(368, 224, 'Common 1, Rare 2, Epic 4, Legendary 8.', 5, COLORS.dim);
    }

    panel(this, 356, 228, 276, 94, { fill: 0x0f1427 });
    this.label(368, 236, 'POTIONS (used in battle with Q)', 6, COLORS.accent);
    Object.values(POTIONS).forEach((p, i) => {
      this.label(368, 254 + i * 14, `${p.name.toUpperCase()}  x${s.potions[p.id] || 0}   ${p.desc}`, 5, COLORS.text);
    });
    this.label(368, 286, `MATERIALS: ${Object.values(MATERIALS).map((m) => `${m.name} x${s.materials[m.id] || 0}`).join('  ')}`, 5, COLORS.dim, { wordWrap: { width: 256 } });
    const ownedHeroes = HERO_IDS.filter((id) => s.heroes[id].owned).length;
    const templates = new Set(items.map((x) => x.templateId)).size;
    this.label(368, 310, `HEROES ${ownedHeroes}/10  TEMPLATES ${templates}/${WEAPON_TEMPLATES.length + ARMOR_TEMPLATES.length}  RARITIES ${RARITIES.length}`, 5, COLORS.dim);
  }

  async act(url, body, okMsg) {
    const res = await this.run(post(url, body), okMsg);
    if (res) this.render();
  }
}
