// Settings: volumes and display options. Saved to the server and applied to audio at once.
import { panel, button, COLORS } from '../ui.js';
import { PageScene } from './page.js';
import { put } from '../api.js';
import { audio } from '../systems/audio.js';

export class SettingsScene extends PageScene {
  constructor() { super('Settings', 'SETTINGS', 'Saved to your account'); }

  draw(s) {
    const st = s.player.settings;
    panel(this, 8, 46, 624, 276);
    const slider = (y, label, key) => {
      this.label(24, y + 6, label, 7, COLORS.text);
      const pct = Math.round(st[key] * 100);
      this.label(330, y + 6, `${pct}%`, 7, COLORS.accent);
      button(this, 400, y, 32, 24, '-', () => this.save({ [key]: Math.max(0, +(st[key] - 0.1).toFixed(2)) }), { size: 8 });
      button(this, 440, y, 32, 24, '+', () => this.save({ [key]: Math.min(1, +(st[key] + 0.1).toFixed(2)) }), { size: 8 });
    };
    const toggle = (y, label, key) => {
      this.label(24, y + 6, label, 7, COLORS.text);
      button(this, 400, y, 120, 24, st[key] ? 'ON' : 'OFF', () => this.save({ [key]: !st[key] }), {
        size: 7, fill: st[key] ? 0x2f6b3a : 0x5a2a2a,
      });
    };
    slider(64, 'MUSIC VOLUME', 'musicVolume');
    slider(104, 'SFX VOLUME', 'sfxVolume');
    toggle(144, 'DAMAGE NUMBERS', 'showDamageNumbers');
    toggle(184, 'SCREEN SHAKE', 'screenShake');
    this.label(24, 236, 'CONTROLS', 7, COLORS.accent);
    this.label(24, 254, 'MOVE: WASD / ARROWS    RUN: SHIFT (HOLD)', 6, COLORS.dim);
    this.label(24, 268, 'ATTACK: J (TAP 3X FOR COMBO)    DODGE: K / SPACE', 6, COLORS.dim);
    this.label(24, 282, 'SPECIAL: L    POTION: Q    PAUSE: ESC / P', 6, COLORS.dim);
    this.label(24, 300, 'TOUCH: LEFT JOYSTICK TO MOVE, BUTTONS ON RIGHT', 6, COLORS.dim);
    audio.setVolumes(st.musicVolume, st.sfxVolume);
  }

  async save(patch) {
    const res = await this.run(put('/api/settings', patch));
    if (res) audio.setVolumes(res.player.settings.musicVolume, res.player.settings.sfxVolume);
  }
}
