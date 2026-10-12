// Small widget toolkit built on Phaser primitives. Everything is drawn with
// rectangles and text so no extra art is needed for UI chrome.
export const COLORS = {
  bg: 0x0b0d18, panel: 0x161a2e, panelEdge: 0x3d4a7a, text: '#e8ecf7', dim: '#8f9bc2',
  accent: '#ffb83d', good: '#7de07d', bad: '#ff6b6b', hpBar: 0xe04848, mana: 0x4f9dff, xp: 0xc58bff,
  rarity: { common: '#b8c4cf', rare: '#4fa3ff', epic: '#b26bff', legendary: '#ffb83d' },
};

export const FONT = 'PressStart2P';

// Phaser text colours must be strings; numeric palette entries (bars, fills) are converted here.
const hexColor = (c) => (typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : c);

export function text(scene, x, y, str, size = 8, color = COLORS.text, opts = {}) {
  return scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color: hexColor(color), ...opts })
    .setOrigin(opts.originX ?? 0, opts.originY ?? 0)
    .setResolution(1);
}

export function panel(scene, x, y, w, h, opts = {}) {
  const g = scene.add.graphics();
  g.fillStyle(opts.fill ?? COLORS.panel, opts.alpha ?? 0.97);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, opts.edge ?? COLORS.panelEdge, 1);
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  return g;
}

// Clickable button. Returns { container, setEnabled(bool), setLabel(str) }.
export function button(scene, x, y, w, h, label, onClick, opts = {}) {
  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const draw = (fill, edge) => {
    bg.clear();
    bg.fillStyle(0x000000, 1).fillRect(-2, -2, w + 4, h + 4);
    bg.fillStyle(fill, 1).fillRect(0, 0, w, h);
    bg.fillStyle(0xffffff, 0.12).fillRect(2, 2, w - 4, 2);
    bg.lineStyle(2, edge, 1).strokeRect(2, 2, w - 4, h - 4);
  };
  const base = opts.fill ?? 0x2a3560;
  const edge = opts.edge ?? 0x8fa3d9;
  draw(base, edge);
  const t = text(scene, w / 2, h / 2, label, opts.size ?? 8, opts.color ?? COLORS.text, { originX: 0.5, originY: 0.5 });
  container.add([bg, t]);
  const hit = scene.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
  container.add(hit);
  let enabled = opts.enabled !== false;
  const refresh = (hover) => {
    if (!enabled) { draw(0x262a3a, 0x4a4f63); t.setColor('#6d7388'); return; }
    draw(hover ? lighten(base) : base, hover ? 0xffb83d : edge);
    t.setColor(opts.color ?? COLORS.text);
  };
  hit.on('pointerover', () => refresh(true));
  hit.on('pointerout', () => refresh(false));
  hit.on('pointerdown', () => { if (enabled) { onClick?.(); } });
  refresh(false);
  if (scene.uiButtons) scene.uiButtons.push(container);
  return {
    container,
    setEnabled(v) { enabled = !!v; refresh(false); },
    setLabel(s) { t.setText(s); },
  };
}


function lighten(c) {
  const r = Math.min(255, ((c >> 16) & 255) + 40);
  const g = Math.min(255, ((c >> 8) & 255) + 40);
  const b = Math.min(255, (c & 255) + 40);
  return (r << 16) | (g << 8) | b;
}

export function bar(scene, x, y, w, h, color, bgColor = 0x000000) {
  const g = scene.add.graphics();
  return {
    g,
    set(ratio, col) {
      const r = Math.max(0, Math.min(1, ratio));
      g.clear();
      g.fillStyle(bgColor, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle(col ?? color, 1).fillRect(x, y, Math.round(w * r), h);
    },
  };
}

export function rarityColor(r) {
  return COLORS.rarity[r] || COLORS.rarity.common;
}

// Modal dialog with a title, body lines and buttons. Returns a handle with destroy().
export function modal(scene, title, lines, buttons, width = 380) {
  const cx = 320;
  const lineH = 12;
  const height = 60 + lines.length * lineH + 40 + 26;
  const x = cx - width / 2;
  const y = 180 - height / 2;
  const objs = [];
  const blocker = scene.add.zone(320, 180, 640, 360).setInteractive();
  objs.push(blocker);
  const shade = scene.add.graphics().fillStyle(0x000000, 0.6).fillRect(0, 0, 640, 360);
  objs.push(shade);
  objs.push(panel(scene, x, y, width, height));
  objs.push(text(scene, cx, y + 12, title, 9, COLORS.accent, { originX: 0.5 }));
  lines.forEach((l, i) => objs.push(text(scene, x + 14, y + 36 + i * lineH, l, 6, COLORS.text, { wordWrap: { width: width - 28 } })));
  const btnW = Math.min(150, Math.floor((width - 24 - (buttons.length - 1) * 8) / buttons.length));
  const handles = [];
  buttons.forEach((b, i) => {
    const bx = x + 12 + i * (btnW + 8);
    const by = y + height - 34;
    const h = button(scene, bx, by, btnW, 24, b.label, () => { destroy(); b.onClick?.(); }, { fill: b.fill, size: 7 });
    handles.push(h);
    objs.push(h.container);
  });
  function destroy() {
    objs.forEach((o) => o.destroy());
  }
  return { destroy, handles, objs };
}

// Fixed-size scrollable-free grid with paging helpers.
export function paginate(list, page, perPage) {
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const p = Math.max(0, Math.min(pages - 1, page));
  return { page: p, pages, items: list.slice(p * perPage, p * perPage + perPage) };
}

// Standard toast message at the bottom of the screen.
export function toast(scene, msg, kind = 'info') {
  const color = kind === 'error' ? COLORS.bad : kind === 'good' ? COLORS.good : COLORS.text;
  const t = text(scene, 320, 344, msg, 7, color, { originX: 0.5, originY: 0.5, backgroundColor: '#000000cc', padding: { x: 6, y: 4 } });
  scene.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 400, onComplete: () => t.destroy() });
}

// Shows a busy indicator while a promise runs; reports errors as toasts.
export async function act(scene, promise, { okMsg, onErrorToast = true } = {}) {
  scene.input.enabled = true;
  try {
    const result = await promise;
    if (okMsg) toast(scene, okMsg, 'good');
    return result;
  } catch (err) {
    if (onErrorToast) toast(scene, err.message || 'Something went wrong.', 'error');
    throw err;
  }
}

// Common screen header and back button.
export function header(scene, title, subtitle = '') {
  panel(scene, 0, 0, 640, 40, { fill: 0x0b0d18, edge: 0x2b3560 });
  text(scene, 16, 12, title, 11, COLORS.accent);
  if (subtitle) text(scene, 620, 14, subtitle, 6, COLORS.dim, { originX: 1 });
}

export function backButton(scene, onBack = () => scene.scene.start('Menu')) {
  return button(scene, 8, 326, 110, 26, 'BACK', onBack, { fill: 0x2a3560 });
}

// Portrait with nearest-neighbour scaling. Returns the image object or null.
export function portrait(scene, x, y, heroId, scale = 2, locked = false) {
  const key = `portrait-${heroId}`;
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(x, y, key).setOrigin(0, 0).setScale(scale);
  if (locked) img.setTint(0x33384d);
  return img;
}

// Common chrome for simple menu screens.
export function screenBase(scene, title, subtitle = '') {
  scene.cameras.main.setBackgroundColor(0x0b0d18);
  scene.add.graphics().fillStyle(0x10142a, 1).fillRect(0, 0, 640, 360);
  header(scene, title, subtitle);
  scene.uiButtons = [];
}

export function coinsLine(scene, state, x = 630, y = 14) {
  if (!state) return null;
  return text(scene, x, y, `${state.player.coins} COIN  ${state.player.crystals} CRY`, 6, COLORS.accent, { originX: 1 });
}
