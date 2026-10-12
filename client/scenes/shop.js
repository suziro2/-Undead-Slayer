// Shop: potions and materials bought with coins. No real-money items.
import { SHOP, POTIONS, MATERIALS } from '../../shared/data.js';
import { panel, button, COLORS } from '../ui.js';
import { PageScene } from './page.js';
import { post } from '../api.js';

export class ShopScene extends PageScene {
  constructor() { super('Shop', 'SHOP', 'Buy supplies with coins earned in battle'); }

  draw(s) {
    this.label(330, 14, `COINS ${s.player.coins}`, 7, COLORS.accent, { originX: 1 });
    const section = (title, list, y) => {
      panel(this, 8, y, 624, 22 + list.length * 40, { fill: 0x0f1427 });
      this.label(18, y + 8, title, 7, COLORS.accent);
      list.forEach((entry, i) => {
        const row = y + 26 + i * 40;
        const info = entry.kind === 'potion' ? POTIONS[entry.id] : MATERIALS[entry.id];
        this.label(18, row + 4, `${info.name.toUpperCase()}  x${entry.qty}`, 7, COLORS.text);
        this.label(18, row + 20, info.desc, 5, COLORS.dim);
        const owned = entry.kind === 'potion' ? (s.potions[entry.id] || 0) : (s.materials[entry.id] || 0);
        this.label(360, row + 8, `OWNED ${owned}`, 6, COLORS.dim);
        button(this, 480, row + 6, 140, 26, `BUY ${entry.price} COIN`, () => this.buy(entry.id), {
          size: 6, enabled: s.player.coins >= entry.price,
        });
      });
    };
    section('POTIONS', SHOP.potions, 40);
    section('MATERIALS', SHOP.materials, 40 + 22 + SHOP.potions.length * 40 + 14);
    this.label(18, 318, 'Potions heal 35% and 70%. Health potions have a 5s cooldown in battle. No healing above max HP.', 5, COLORS.dim);
  }

  async buy(itemId) {
    await this.run(post('/api/shop/buy', { itemId }), 'Purchased');
  }
}
