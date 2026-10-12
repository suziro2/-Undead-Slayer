// Summon (gacha): single and ten pulls with earned currency only. Shows rates, pity,
// history, and a reveal sequence for each pull.
import { GACHA, HEROES, RARITIES, RARITY } from '../../shared/data.js';
import { panel, button, portrait, rarityColor, COLORS } from '../ui.js';
import { PageScene } from './page.js';
import { post } from '../api.js';
import { audio } from '../systems/audio.js';

export class SummonScene extends PageScene {
  constructor() { super('Summon', 'SUMMON', 'Earned currency only. Duplicates become fragments.'); }

  create(data) {
    this.reveal = null;
    super.create(data);
  }

  draw(s) {
    panel(this, 8, 46, 232, 276);
    this.label(18, 56, 'DISPLAYED RATES', 6, COLORS.accent);
    RARITIES.forEach((r, i) => {
      const names = GACHA.pools[r].map((id) => HEROES[id].name).join(', ');
      this.label(18, 74 + i * 34, `${RARITY[r].label.toUpperCase()} ${(GACHA.rates[r] * 100).toFixed(0)}%`, 7, rarityColor(r));
      this.label(18, 88 + i * 34, names, 5, COLORS.dim, { wordWrap: { width: 214 } });
    });
    this.label(18, 214, `EPIC+ PITY ${s.player.pity.epic}/${GACHA.pity.epicAfter}`, 6, COLORS.xp);
    this.label(18, 230, `LEGEND PITY ${s.player.pity.legendary}/${GACHA.pity.legendaryAfter}`, 6, COLORS.accent);
    this.label(18, 248, `Summons: ${s.player.stats.summons}`, 6, COLORS.dim);
    this.label(18, 262, `Coins ${s.player.coins}   Crystals ${s.player.crystals}`, 5, COLORS.text);

    const opts = [
      ['SINGLE  150 COIN', 'coins', 1, GACHA.singleCostCoins],
      ['SINGLE  10 CRY', 'crystals', 1, GACHA.singleCostCrystals],
      ['TEN  1350 COIN', 'coins', 10, GACHA.multiCostCoins],
      ['TEN  90 CRY', 'crystals', 10, GACHA.multiCostCrystals],
    ];
    opts.forEach(([label, cur, count, cost], i) => {
      const enabled = (cur === 'coins' ? s.player.coins : s.player.crystals) >= cost;
      button(this, 252 + (i % 2) * 190, 46 + Math.floor(i / 2) * 36, 184, 28, label, () => this.summon(cur, count), {
        enabled: enabled && !this.reveal, size: 6, fill: cur === 'crystals' ? 0x2b4a7a : 0x6a4c12,
      });
    });

    panel(this, 252, 128, 380, 194);
    this.label(262, 138, 'RECENT PULLS', 6, COLORS.accent);
    const hist = this.history || [];
    hist.slice(0, 8).forEach((h, i) => {
      const y = 156 + i * 20;
      this.label(262, y, HEROES[h.heroId].name.toUpperCase(), 6, rarityColor(h.rarity));
      this.label(380, y, h.rarity.toUpperCase(), 5, rarityColor(h.rarity));
      this.label(500, y, h.duplicate ? `DUP +${h.fragments}F` : 'NEW', 5, h.duplicate ? COLORS.mana : COLORS.good);
      if (h.pity) this.label(580, y, 'PITY', 5, COLORS.xp);
    });
    if (!hist.length) this.label(262, 160, 'No summons yet.', 6, COLORS.dim);
    if (!this.historyLoaded) this.loadHistory();
    this.label(252, 326, 'Summons have no real-money option. Rates are shown as in the server table.', 5, COLORS.dim);
  }

  async loadHistory() {
    this.historyLoaded = true;
    try {
      const { get } = await import('../api.js');
      const res = await get('/api/gacha/history');
      this.history = res.history;
      if (this.sys.isActive()) this.render();
    } catch { /* history is optional */ }
  }

  async summon(currency, count) {
    if (this.reveal) return;
    const res = await this.run(post('/api/gacha/summon', { currency, count }));
    if (!res) return;
    this.historyLoaded = false;
    this.history = [...res.results.map((r) => ({ ...r, heroId: r.heroId })), ...(this.history || [])];
    this.render();
    this.showReveal(res.results);
  }

  showReveal(results) {
    audio.sfx('summon');
    const objs = [];
    const shade = this.add.graphics().fillStyle(0x000000, 0.85).fillRect(0, 0, 640, 360);
    objs.push(shade);
    const blocker = this.add.zone(320, 180, 640, 360).setInteractive();
    objs.push(blocker);
    const ring = this.add.graphics();
    objs.push(ring);
    const card = this.add.container(320, 180);
    objs.push(card);
    const title = this.label(320, 40, 'SUMMONING...', 10, COLORS.accent, { originX: 0.5 });
    objs.push(title);
    const hint = this.label(320, 330, 'Click to continue', 6, COLORS.dim, { originX: 0.5 });
    objs.push(hint);
    let index = 0;
    let done = false;
    const cleanup = () => { objs.forEach((o) => o.destroy()); this.reveal = null; this.render(); };
    const showCard = () => {
      card.removeAll(true);
      if (index >= results.length) {
        title.setText(`${results.length} PULL${results.length > 1 ? 'S' : ''} COMPLETE`);
        hint.setText('Click to close');
        const cols = Math.min(5, results.length);
        results.forEach((r, i) => {
          const cx = -((cols - 1) * 62) / 2 + (i % cols) * 62;
          const cy = -60 + Math.floor(i / cols) * 70;
          const box = this.add.graphics().lineStyle(2, Phaser.Display.Color.HexStringToColor(rarityColor(r.rarity)).color, 1).strokeRect(cx - 24, cy - 26, 48, 52);
          const p = portrait(this, cx - 24 + 2, cy - 22, r.heroId, 1);
          card.add([box, p].filter(Boolean));
          card.add(this.label(cx, cy + 30, r.duplicate ? `+${r.fragments}F` : 'NEW', 5, r.duplicate ? COLORS.mana : COLORS.good, { originX: 0.5 }));
        });
        return;
      }
      const r = results[index];
      title.setText(`${index + 1}/${results.length}`);
      const hero = HEROES[r.heroId];
      const bg = this.add.graphics();
      bg.fillStyle(0x161a2e, 1).fillRect(-90, -110, 180, 220);
      bg.lineStyle(4, Phaser.Display.Color.HexStringToColor(rarityColor(r.rarity)).color, 1).strokeRect(-90, -110, 180, 220);
      card.add(bg);
      card.add(this.add.graphics().fillStyle(Phaser.Display.Color.HexStringToColor(rarityColor(r.rarity)).color, 0.25).fillRect(-86, -106, 172, 90));
      const p = portrait(this, -64, -94, r.heroId, 2, false);
      if (p) card.add(p);
      card.add(this.label(0, 10, hero.name.toUpperCase(), 10, COLORS.text, { originX: 0.5 }));
      card.add(this.label(0, 30, r.rarity.toUpperCase(), 8, rarityColor(r.rarity), { originX: 0.5 }));
      card.add(this.label(0, 50, r.duplicate ? `DUPLICATE  +${r.fragments} FRAG` : 'NEW HERO!', 7, r.duplicate ? COLORS.mana : COLORS.good, { originX: 0.5 }));
      if (r.pity) card.add(this.label(0, 70, 'PITY GUARANTEE', 6, COLORS.xp, { originX: 0.5 }));
      audio.sfx(r.rarity === 'legendary' || r.rarity === 'epic' ? 'reveal' : 'click');
      card.setScale(0.2);
      this.tweens.add({ targets: card, scale: 1, duration: 220, ease: 'Back.Out' });
      ring.clear().lineStyle(2, Phaser.Display.Color.HexStringToColor(rarityColor(r.rarity)).color, 0.7).strokeCircle(320, 180, 120);
    };
    blocker.on('pointerdown', () => {
      if (done) return cleanup();
      index += 1;
      if (index >= results.length) done = true;
      showCard();
    });
    this.reveal = { objs };
    index = 0;
    showCard();
    if (results.length === 0) done = true;
  }
}
