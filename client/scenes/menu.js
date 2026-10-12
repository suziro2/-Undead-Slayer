// Main menu: profile summary plus navigation to every screen.
import { text, panel, button, bar, portrait, COLORS } from '../ui.js';
import { session } from '../session.js';
import { audio } from '../systems/audio.js';

const NAV = [
  ['ADVENTURE', 'Adventure'], ['COLLECTION', 'Collection'], ['SUMMON', 'Summon'],
  ['UPGRADES', 'Upgrades'], ['INVENTORY', 'Inventory'], ['SHOP', 'Shop'],
  ['PROFILE', 'Profile'], ['SETTINGS', 'Settings'], ['LOGOUT', null],
];

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d18);
    this.add.graphics().fillStyle(0x10142a, 1).fillRect(0, 0, 640, 360);
    this.add.image(320, 4, 'title').setOrigin(0.5, 0).setAlpha(0.35).setDisplaySize(640, 200);
    const s = session.state;
    if (!s) return;
    const logo = this.add.image(20, 14, 'logo').setOrigin(0, 0);
    logo.setScale(Math.min(1, 210 / logo.width));

    panel(this, 16, 92, 220, 254);
    const hero = s.heroes[s.player.selectedHero];
    portrait(this, 24, 104, s.player.selectedHero, 1);
    text(this, 100, 110, hero ? this.heroName(s.player.selectedHero) : '', 8, COLORS.accent);
    text(this, 100, 128, `LV ${s.player.level}`, 7, COLORS.text);
    text(this, 30, 180, `SLAYER: ${s.user.username}`, 7, COLORS.text);
    text(this, 30, 196, `PLAYER XP ${s.player.xpIntoLevel}/${s.player.xpToNext || 'MAX'}`, 6, COLORS.dim);
    bar(this, 30, 208, 190, 6, COLORS.xp).set(s.player.xpToNext ? s.player.xpIntoLevel / s.player.xpToNext : 1);
    text(this, 30, 226, `COINS ${s.player.coins}`, 7, COLORS.accent);
    text(this, 30, 242, `CRYSTALS ${s.player.crystals}`, 7, COLORS.mana);
    const done = s.campaign.completed.length;
    text(this, 30, 262, `CAMPAIGN ${done}/${s.campaign.totalLevels}`, 7, COLORS.good);
    bar(this, 30, 276, 190, 6, COLORS.good).set(done / s.campaign.totalLevels);
    text(this, 30, 292, `HEROES ${s.player.stats.heroesOwned}/10`, 6, COLORS.dim);
    text(this, 30, 320, 'Keyboard: WASD/arrows, J attack, K dodge, L special', 5, COLORS.dim);

    NAV.forEach(([label, scene], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 252 + col * 124;
      const y = 92 + row * 60;
      button(this, x, y, 116, 46, label, () => {
        if (label === 'LOGOUT') {
          window.dispatchEvent(new CustomEvent('gravemark:logout'));
          return;
        }
        this.scene.start(scene);
      }, { fill: label === 'LOGOUT' ? 0x4a2630 : 0x2a3560, size: 7 });
    });
    text(this, 252, 280, 'Choose a screen to continue.', 6, COLORS.dim);
    text(this, 252, 294, `Selected hero: ${hero ? this.heroName(s.player.selectedHero) : '-'} (team ${1 + s.player.team.length}/3)`, 6, COLORS.dim);
    audio.playMusic('menu');
  }

  heroName(id) {
    return { aiden: 'AIDEN', luna: 'LUNA', ronan: 'RONAN', mira: 'MIRA', kael: 'KAEL', bruno: 'BRUNO', sylvie: 'SYLVIE', darius: 'DARIUS', elian: 'ELIAN', riven: 'RIVEN' }[id];
  }
}
