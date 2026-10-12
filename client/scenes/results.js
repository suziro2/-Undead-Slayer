// Results after a battle: rewards and drops as reported by the server, level-up notice,
// boss chest, and buttons to retry, return to the map, or go to the menu.
import { WEAPON_TEMPLATES, ARMOR_TEMPLATES, CHAPTERS, BOSSES, LEVEL_KIND } from '../../shared/data.js';
import { panel, button, text, rarityColor, COLORS } from '../ui.js';
import { post } from '../api.js';
import { session } from '../session.js';
import { audio } from '../systems/audio.js';

const TEMPLATE_NAMES = Object.fromEntries([...WEAPON_TEMPLATES, ...ARMOR_TEMPLATES].map((t) => [t.id, t.name]));
const MATERIAL_NAMES = { iron_ore: 'Iron Ore', rune_shard: 'Rune Shard' };
const POTION_NAMES = { health_potion: 'Health Potion', greater_potion: 'Greater Potion' };

export class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }

  init(data) {
    this.data_ = data;
  }

  create() {
    const d = this.data_;
    const r = d.result;
    this.cameras.main.setBackgroundColor(0x0b0d18);
    this.add.graphics().fillStyle(0x10142a, 1).fillRect(0, 0, 640, 360);
    const title = r.cleared ? 'VICTORY' : d.retreat ? 'RETREAT' : 'DEFEAT';
    const color = r.cleared ? COLORS.accent : d.retreat ? COLORS.dim : COLORS.bad;
    text(this, 320, 18, title, 16, color, { originX: 0.5 });
    text(this, 320, 40, `${CHAPTERS.find((c) => c.id === d.chapter).name.toUpperCase()}  -  ${LEVEL_KIND[d.level].toUpperCase()} L${d.level}`, 7, COLORS.dim, { originX: 0.5 });
    if (r.cleared && d.isBoss) text(this, 320, 56, `${BOSSES[CHAPTERS.find((c) => c.id === d.chapter).boss].name.toUpperCase()} DEFEATED`, 7, COLORS.bad, { originX: 0.5 });
    if (!r.cleared && !d.retreat) text(this, 320, 56, 'Your rewards for kills still count. Try again!', 6, COLORS.dim, { originX: 0.5 });
    audio.sfx(r.cleared ? 'win' : 'lose');

    panel(this, 16, 74, 300, 230);
    text(this, 28, 84, 'REWARDS', 8, COLORS.accent);
    const rw = r.rewards;
    const lines = [
      [`+${rw.coins} COINS`, COLORS.accent],
      [`+${rw.xp} XP`, COLORS.xp],
      [`+${rw.crystals} CRYSTALS`, COLORS.mana],
      [`KILLS ${Object.values(d.kills).reduce((a, b) => a + b, 0)}`, COLORS.text],
      [r.firstClear ? 'FIRST CLEAR BONUS!' : (r.cleared ? 'Replay: no clear bonus' : 'Not cleared: no clear bonus'), r.firstClear ? COLORS.good : COLORS.dim],
    ];
    if (r.levelsGained > 0) lines.push([`PLAYER LEVEL UP x${r.levelsGained}  (+${r.levelsGained * 2} STAT POINTS)`, COLORS.xp]);
    lines.forEach(([t, c], i) => text(this, 28, 104 + i * 16, t, 7, c));

    const drops = r.drops || {};
    const dropLines = [];
    if (drops.chest) {
      dropLines.push(['BOSS CHEST', COLORS.accent]);
      dropLines.push([`Iron Ore ${drops.chest.ore ?? ''}`.trim(), COLORS.text]);
      dropLines.push([`${drops.chest.items.length} equipment, Greater Potion`, COLORS.text]);
      dropLines.push(...drops.chest.items.map((it) => [`${TEMPLATE_NAMES[it.templateId]} (${it.rarity})`, rarityColor(it.rarity)]));
    }
    Object.entries(drops.materials || {}).forEach(([id, n]) => dropLines.push([`+${n} ${MATERIAL_NAMES[id]}`, COLORS.text]));
    Object.entries(drops.potions || {}).forEach(([id, n]) => dropLines.push([`+${n} ${POTION_NAMES[id]}`, COLORS.good]));
    (drops.items || []).forEach((it) => dropLines.push([`${TEMPLATE_NAMES[it.templateId]} (${it.rarity})`, rarityColor(it.rarity)]));
    panel(this, 326, 74, 298, 230);
    text(this, 338, 84, 'DROPS', 8, COLORS.accent);
    dropLines.slice(0, 14).forEach(([t, c], i) => text(this, 338, 104 + i * 13, t, 6, c));
    if (!dropLines.length) text(this, 338, 104, 'No drops this time.', 6, COLORS.dim);
    if (dropLines.length > 14) text(this, 338, 104 + 14 * 13, `...and ${dropLines.length - 14} more`, 5, COLORS.dim);

    if (session.state) text(this, 16, 312, `Coins ${session.state.player.coins}   Crystals ${session.state.player.crystals}   Iron Ore ${session.state.materials.iron_ore || 0}`, 6, COLORS.dim);

    const battleRetry = async () => {
      try {
        const battle = await post('/api/battle/start', { chapter: d.chapter, level: d.level });
        this.scene.start('Battle', { battle, chapter: d.chapter, level: d.level });
      } catch (err) {
        text(this, 320, 336, err.message, 6, COLORS.bad, { originX: 0.5 });
      }
    };
    button(this, 16, 326, 130, 26, 'RETRY', battleRetry, { fill: 0x7a2b2b, size: 7 });
    button(this, 154, 326, 170, 26, 'ADVENTURE', () => this.scene.start('Adventure', { chapterId: d.chapter }), { size: 7 });
    button(this, 332, 326, 130, 26, 'MENU', () => this.scene.start('Menu'), { size: 7 });
    if (r.state && r.cleared && !d.isBoss) {
      const nextLevel = d.level + 1;
      if (nextLevel <= 5) {
        button(this, 470, 326, 154, 26, `NEXT L${nextLevel}`, async () => {
          try {
            const battle = await post('/api/battle/start', { chapter: d.chapter, level: nextLevel });
            this.scene.start('Battle', { battle, chapter: d.chapter, level: nextLevel });
          } catch (err) {
            text(this, 320, 336, err.message, 6, COLORS.bad, { originX: 0.5 });
          }
        }, { size: 7, fill: 0x2f6b3a });
      }
    }
  }
}
