// Profile: account details, achievements, password change, recovery-code regeneration, logout.
import { ACHIEVEMENTS } from '../../shared/data.js';
import { panel, button, bar, COLORS } from '../ui.js';
import { PageScene } from './page.js';
import { post } from '../api.js';
import { promptForm, showRecoveryCode } from '../auth-ui.js';
import { session } from '../session.js';

export class ProfileScene extends PageScene {
  constructor() { super('Profile', 'PROFILE', 'Account, achievements and security'); }

  draw(s) {
    panel(this, 8, 46, 300, 276);
    this.label(18, 56, 'SLAYER', 6, COLORS.accent);
    this.label(18, 72, s.user.username, 11, COLORS.text);
    this.label(18, 96, `EMAIL ${s.user.email}`, 5, COLORS.dim, { wordWrap: { width: 280 } });
    this.label(18, 118, `PLAYER LEVEL ${s.player.level}`, 7, COLORS.xp);
    bar(this, 18, 132, 280, 6, COLORS.xp).set(s.player.xpToNext ? s.player.xpIntoLevel / s.player.xpToNext : 1);
    this.label(18, 146, `XP ${s.player.xp}   STAT POINTS ${s.player.statPoints}`, 5, COLORS.dim);
    this.label(18, 166, `KILLS ${s.player.stats.totalKills}   BOSSES ${s.player.stats.bossesDefeated}`, 6);
    this.label(18, 182, `SUMMONS ${s.player.stats.summons}   HEROES ${s.player.stats.heroesOwned}/10`, 6);
    this.label(18, 198, `CHAPTERS ${s.player.stats.chaptersCompleted}/10   LEVELS ${s.campaign.completed.length}/${s.campaign.totalLevels}`, 6);
    button(this, 18, 230, 276, 24, 'CHANGE PASSWORD', () => this.changePassword(), { size: 6 });
    button(this, 18, 262, 276, 24, 'NEW RECOVERY CODE', () => this.newRecovery(), { size: 6 });
    button(this, 18, 294, 276, 20, 'LOG OUT', () => window.dispatchEvent(new CustomEvent('gravemark:logout')), { size: 6, fill: 0x4a2630 });

    panel(this, 316, 46, 316, 276);
    this.label(328, 56, 'ACHIEVEMENTS', 7, COLORS.accent);
    const have = new Set(s.achievements);
    ACHIEVEMENTS.forEach((a, i) => {
      const y = 76 + i * 38;
      const got = have.has(a.id);
      this.label(328, y, `${got ? '[X]' : '[ ]'} ${a.name.toUpperCase()}`, 6, got ? COLORS.good : COLORS.text);
      this.label(328, y + 14, `${a.desc}  Reward ${a.crystals} crystals`, 5, COLORS.dim, { wordWrap: { width: 290 } });
    });
  }

  async changePassword() {
    const values = await promptForm({
      title: 'Change password',
      hint: 'Other devices will be signed out. Use 8-128 characters with a letter and a number.',
      fields: [
        { name: 'currentPassword', label: 'Current password', type: 'password', autocomplete: 'current-password' },
        { name: 'newPassword', label: 'New password', type: 'password', autocomplete: 'new-password' },
      ],
      submitLabel: 'Change',
    });
    if (!values) return;
    await this.run(post('/api/profile/password', values), 'Password changed');
  }

  async newRecovery() {
    const values = await promptForm({
      title: 'New recovery code',
      hint: 'This replaces your current recovery code. The old one stops working.',
      fields: [{ name: 'password', label: 'Current password', type: 'password', autocomplete: 'current-password' }],
      submitLabel: 'Generate',
    });
    if (!values) return;
    try {
      const { recoveryCode } = await post('/api/profile/recovery-code', values);
      showRecoveryCode(recoveryCode, () => {}, 'New recovery code');
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }
}
