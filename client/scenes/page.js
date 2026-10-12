// Base class for menu-style screens. render() clears the display list and redraws
// everything from session.state, so every action can simply re-render the page.
import { header, toast, act, button, text, COLORS } from '../ui.js';
import { session } from '../session.js';

export class PageScene extends Phaser.Scene {
  constructor(key, title, subtitle = '') {
    super(key);
    this.pageTitle = title;
    this.pageSubtitle = subtitle;
  }

  create(data = {}) {
    this.params = data || {};
    this.unsubscribe?.();
    this.unsubscribe = session.onChange(() => { if (this.sys.isActive()) this.render(); });
    this.events.once('shutdown', () => this.unsubscribe?.());
    this.render();
  }

  render() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor(0x0b0d18);
    this.add.graphics().fillStyle(0x10142a, 1).fillRect(0, 0, 640, 360);
    header(this, this.pageTitle, this.pageSubtitle);
    if (session.state) this.draw(session.state);
    this.backButton();
  }

  // Overridden by subclasses. `s` is the current server state.
  draw() {}

  backButton(target = 'Menu') {
    button(this, 8, 326, 100, 26, 'BACK', () => this.scene.start(target), { fill: 0x2a3560, size: 7 });
  }

  // Runs a server call with busy-lock and toasts. On success, state is applied and the page redraws.
  async run(promise, okMsg) {
    if (this.busy) return null;
    this.busy = true;
    try {
      const payload = await act(this, promise, { okMsg });
      // Summon/battle responses wrap the state; every other mutation returns it directly.
      if (payload?.state) session.apply(payload);
      else if (payload?.player) session.apply({ state: payload });
      return payload;
    } catch {
      return null;
    } finally {
      this.busy = false;
    }
  }

  notify(msg, kind) {
    toast(this, msg, kind);
  }

  label(x, y, str, size = 7, color = COLORS.text, opts = {}) {
    return text(this, x, y, str, size, color, opts);
  }
}
