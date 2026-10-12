// Campaign map: pick a chapter, see its five levels, start a battle.
import { CHAPTERS, BOSSES, LEVEL_KIND, LEVELS_PER_CHAPTER } from '../../shared/data.js';
import { isLevelUnlocked, levelKey, isChapterCompleted } from '../../shared/rules.js';
import { panel, button, paginate, COLORS } from '../ui.js';
import { PageScene } from './page.js';
import { post } from '../api.js';
import { act } from '../ui.js';
import { audio } from '../systems/audio.js';

export class AdventureScene extends PageScene {
  constructor() { super('Adventure', 'ADVENTURE', 'Clear levels in order. Replay any cleared level.'); }

  create(data) {
    this.chapterPage = 0;
    this.chapterId = data?.chapterId || this.chapterId || null;
    super.create(data);
  }

  draw(s) {
    const completed = new Set(s.campaign.completed);
    const pg = paginate(CHAPTERS, this.chapterPage, 5);
    this.chapterPage = pg.page;
    pg.items.forEach((c, i) => {
      const locked = !isLevelUnlocked(completed, c.id, 1);
      const done = isChapterCompleted(completed, c.id);
      const y = 44 + i * 50;
      const selected = this.chapterId === c.id;
      button(this, 8, y, 200, 44, `${c.id}. ${c.name}`, () => { this.chapterId = c.id; this.render(); }, {
        fill: selected ? 0x3a4a80 : 0x222a4a, size: 6,
        edge: done ? COLORS.good : selected ? COLORS.accent : 0x8fa3d9,
        color: locked ? '#6d7388' : COLORS.text,
      });
      this.label(14, y + 30, locked ? 'LOCKED' : done ? 'CLEARED' : 'OPEN', 5, locked ? COLORS.bad : COLORS.good);
    });
    button(this, 8, 302, 96, 20, '< PREV', () => { this.chapterPage -= 1; this.render(); }, { size: 6, enabled: pg.page > 0 });
    button(this, 112, 302, 96, 20, 'NEXT >', () => { this.chapterPage += 1; this.render(); }, { size: 6, enabled: pg.page < pg.pages - 1 });
    this.label(216, 28, `PAGE ${pg.page + 1}/${pg.pages}`, 5, COLORS.dim);

    if (!this.chapterId) this.chapterId = CHAPTERS[0].id;
    const chapter = CHAPTERS.find((c) => c.id === this.chapterId);
    const boss = BOSSES[chapter.boss];
    panel(this, 220, 44, 412, 302);
    this.label(236, 56, `CHAPTER ${chapter.id}`, 6, COLORS.dim);
    this.label(236, 70, chapter.name, 10, COLORS.accent);
    this.label(236, 90, chapter.subtitle, 5, COLORS.text, { wordWrap: { width: 380 } });
    this.label(236, 118, `BOSS: ${boss.name}`, 6, COLORS.bad);
    this.label(236, 130, boss.title, 5, COLORS.dim);

    for (let lv = 1; lv <= LEVELS_PER_CHAPTER; lv += 1) {
      const key = levelKey(chapter.id, lv);
      const unlocked = isLevelUnlocked(completed, chapter.id, lv);
      const prog = s.campaign.levels[key];
      const y = 150 + (lv - 1) * 34;
      panel(this, 236, y, 380, 30, { fill: 0x0f1427 });
      const kind = LEVEL_KIND[lv];
      this.label(246, y + 5, `L${lv} ${kind.toUpperCase()}`, 6, lv === 5 ? COLORS.bad : lv === 4 ? COLORS.accent : COLORS.text);
      const info = !unlocked ? 'Locked: clear the previous level' : prog ? `Clears ${prog.clears}  Best ${prog.bestKills} kills` : 'Not cleared yet';
      this.label(246, y + 17, info, 5, unlocked ? COLORS.dim : COLORS.bad);
      button(this, 486, y + 4, 116, 22, unlocked ? (lv === 5 ? 'FIGHT BOSS' : 'PLAY') : 'LOCKED', () => this.startLevel(chapter.id, lv), {
        enabled: unlocked && !this.starting, size: 6, fill: lv === 5 ? 0x7a2b2b : 0x2a3560,
      });
    }
    this.label(236, 322, `Clear reward: ${1000 + 300 * chapter.id} coins, ${30 + 5 * chapter.id} crystals (first clear).`, 5, COLORS.dim);
    const team = s.player.team.length ? `Team: ${[s.player.selectedHero, ...s.player.team].join(', ')}` : `Solo: ${s.player.selectedHero}`;
    this.label(236, 336, `${team}  (change in Collection)`, 5, COLORS.dim);
  }

  async startLevel(chapter, level) {
    if (this.starting) return;
    this.starting = true;
    try {
      const battle = await act(this, post('/api/battle/start', { chapter, level }));
      audio.sfx('click');
      this.scene.start('Battle', { battle, chapter, level });
    } catch {
      this.starting = false; // act() already showed the reason, e.g. the level is locked.
    }
  }
}
