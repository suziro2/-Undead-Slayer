// Loading scene: real progress from the Phaser loader (100% only after every file loaded),
// rotating tips, a random chapter name with its boss, and an error screen with retry.
import { fetchManifest, queueAssets, createAnims, sheetKey, animKey } from '../systems/assets.js';
import { LOADING_TIPS, CHAPTERS, BOSSES } from '../../shared/data.js';
import { text, panel, button, COLORS } from '../ui.js';
import { session } from '../session.js';
import { audio } from '../systems/audio.js';
import { get } from '../api.js';
import { showAuth } from '../auth-ui.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  init() {
    this.manifest = null;
    this.failed = [];
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x0b0d18);
    this.add.graphics().fillStyle(0x10142a, 1).fillRect(0, 0, 640, 360);
    this.stars = this.add.graphics();
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 97) % 640;
      const y = (i * 53) % 220;
      this.stars.fillStyle(0xffffff, 0.2 + ((i * 7) % 5) * 0.15).fillRect(x, y, 1, 1);
    }
    this.title = text(this, 320, 20, 'LOADING', 12, COLORS.accent, { originX: 0.5 });
    this.percent = text(this, 200, 150, '0%', 10, COLORS.text, { originX: 0.5 });
    this.barBg = panel(this, 40, 170, 320, 16, { fill: 0x000000 });
    this.barFill = this.add.graphics();
    this.statusText = text(this, 200, 196, 'Preparing...', 7, COLORS.dim, { originX: 0.5 });
    this.errorBox = null;

    const chapter = CHAPTERS[Math.floor(Math.random() * CHAPTERS.length)];
    this.chapterText = text(this, 320, 230, `Chapter ${chapter.id}: ${chapter.name}`, 8, COLORS.accent, { originX: 0.5 });
    this.bossText = text(this, 320, 250, `${BOSSES[chapter.boss].name} awaits`, 7, COLORS.dim, { originX: 0.5 });
    this.bossId = chapter.boss;
    this.bossSprite = null;
    this.tipText = text(this, 320, 300, '', 7, COLORS.text, { originX: 0.5, wordWrap: { width: 560 }, align: 'center' });
    this.tipIndex = Math.floor(Math.random() * LOADING_TIPS.length);
    this.tipText.setText(`TIP: ${LOADING_TIPS[this.tipIndex]}`);
    this.tipTimer = this.time.addEvent({
      delay: 2600, loop: true,
      callback: () => {
        this.tipIndex = (this.tipIndex + 1) % LOADING_TIPS.length;
        this.tipText.setText(`TIP: ${LOADING_TIPS[this.tipIndex]}`);
      },
    });
    // Named handlers so they can be removed on shutdown (scene.restart re-runs create()).
    this.handlers = {
      progress: (v) => this.setProgress(v),
      loaderror: (file) => { this.failed.push(file?.key || 'unknown'); },
      bossReady: () => this.showBossArt(),
      complete: () => this.onLoaded(),
    };
    this.load.on('progress', this.handlers.progress);
    this.load.on('loaderror', this.handlers.loaderror);
    this.load.on(`filecomplete-spritesheet-${sheetKey('boss', this.bossId)}`, this.handlers.bossReady);
    this.load.on('complete', this.handlers.complete);
    this.events.once('shutdown', () => {
      this.load.off('progress', this.handlers.progress);
      this.load.off('loaderror', this.handlers.loaderror);
      this.load.off(`filecomplete-spritesheet-${sheetKey('boss', this.bossId)}`, this.handlers.bossReady);
      this.load.off('complete', this.handlers.complete);
      this.tipTimer?.remove();
    });
    this.beginLoad();
  }

  setProgress(v) {
    const pct = Math.round(v * 100);
    this.percent.setText(`${pct}%`);
    this.barFill.clear();
    this.barFill.fillStyle(COLORS.xp, 1).fillRect(42, 172, Math.round(316 * v), 12);
  }

  async beginLoad() {
    this.statusText.setText('Checking fonts...');
    try {
      await Promise.race([document.fonts.load('10px PressStart2P'), new Promise((r) => setTimeout(r, 4000))]);
    } catch { /* fall back to system monospace */ }
    try {
      this.statusText.setText('Reading asset manifest...');
      this.manifest = await fetchManifest();
    } catch (err) {
      this.showError(err.message);
      return;
    }
    this.statusText.setText('Loading sprites and scenery...');
    // Boss sheet first so the chosen boss can appear on the loading screen.
    const bossFirst = Object.keys(this.manifest.sprites).sort((a, b) => (a === `boss:${this.bossId}` ? -1 : b === `boss:${this.bossId}` ? 1 : 0));
    const ordered = { ...this.manifest, sprites: Object.fromEntries(bossFirst.map((k) => [k, this.manifest.sprites[k]])) };
    const queued = queueAssets(this.load, ordered);
    if (queued.length === 0) {
      this.onLoaded();
      return;
    }
    this.load.start();
  }

  showBossArt() {
    if (this.bossSprite || !this.textures.exists(sheetKey('boss', this.bossId))) return;
    this.bossSprite = this.add.sprite(500, 140, sheetKey('boss', this.bossId), 0);
    const anim = this.anims.create({
      key: animKey('boss', this.bossId, 'idle'),
      frames: this.anims.generateFrameNumbers(sheetKey('boss', this.bossId), { start: 0, end: 3 }),
      frameRate: 6, repeat: -1,
    });
    this.bossSprite.play(anim.key);
    this.bossSprite.setDepth(5);
  }

  onLoaded() {
    if (this.errorBox || this.loaded) return;
    if (this.failed.length) {
      this.showError(`Could not load ${this.failed.length} asset file(s): ${this.failed.slice(0, 3).join(', ')}`);
      return;
    }
    if (!this.manifest) return;
    this.loaded = true;
    createAnims(this, this.manifest);
    this.setProgress(1);
    this.percent.setText('100%');
    this.statusText.setText('Ready');
    this.tipTimer.remove();
    this.time.delayedCall(350, () => this.enterGame());
  }

  // Runs after assets are loaded: restores the saved session if there is one, otherwise shows
  // the login overlay. Only then does the menu start, so nothing needs a session before login.
  async enterGame() {
    if (this.entering) return;
    this.entering = true;
    this.statusText.setText('Checking your session...');
    let payload = null;
    try {
      payload = await get('/api/auth/me');
    } catch {
      payload = null;
    }
    if (!payload?.state) {
      this.statusText.setText('Sign in or create an account to continue.');
      payload = await showAuth();
    }
    session.apply(payload);
    this.entering = false;
    if (this.sys.isActive()) this.scene.start('Menu');
  }

  showError(message) {
    this.loaded = false;
    this.failed = [];
    if (this.errorBox) return;
    this.statusText.setText('');
    this.tipTimer?.remove();
    this.errorBox = this.add.container(0, 0);
    this.errorBox.add(panel(this, 110, 110, 420, 140, { fill: 0x1a0d14, edge: 0xff6b6b }));
    this.errorBox.add(text(this, 320, 126, 'Loading failed', 11, COLORS.bad, { originX: 0.5 }));
    this.errorBox.add(text(this, 320, 150, message, 6, COLORS.text, { originX: 0.5, wordWrap: { width: 380 }, align: 'center' }));
    this.errorBox.add(button(this, 220, 200, 200, 28, 'RETRY', () => {
      this.errorBox = null;
      this.scene.restart();
    }, { fill: 0x7a2b2b, edge: 0xff9a9a }).container);
    audio.sfx('error');
  }
}
