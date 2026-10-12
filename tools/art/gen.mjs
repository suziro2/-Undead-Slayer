// Generates every pixel-art asset used by the game and writes public/assets/manifest.json.
// Run with: npm run assets
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFrame } from './rig.mjs';
import { packSheet, Pix, C } from './pix.mjs';
import { buildSheetList, animFor, HERO_ANIMS } from './characters.mjs';
import { farLayer, midLayer, groundTile, titleArt, logo, ENV_IDS } from './scenery.mjs';
import { buildIcons } from './icons.mjs';
import { CHAPTERS } from '../../shared/data.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../public/assets');
const quiet = process.argv.includes('--quiet');

const log = (...a) => { if (!quiet) console.log(...a); };

function writePng(relPath, pix) {
  const full = join(OUT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, pix.toPNG());
}

// Checks that nothing touches the frame border (prevents clipped sprites).
function borderClipped(frame) {
  const { w, h } = frame;
  for (let x = 0; x < w; x += 1) {
    if ((frame.get(x, 0) & 0xff) || (frame.get(x, h - 1) & 0xff)) return true;
  }
  for (let y = 0; y < h; y += 1) {
    if ((frame.get(0, y) & 0xff) || (frame.get(w - 1, y) & 0xff)) return true;
  }
  return false;
}

function renderSheet(entry, warnings) {
  const { spec, anims, kind, id } = entry;
  const [fw, fh] = spec.frame;
  const rows = [];
  const meta = {};
  let maxCols = 0;
  anims.forEach(([name, n, fps, loop], row) => {
    const poses = animFor(spec, name, n, kind === 'hero' ? 'hero' : kind === 'mob' ? 'mob' : 'boss');
    if (poses.length !== n) throw new Error(`${id}.${name}: expected ${n} frames, got ${poses.length}`);
    const rendered = poses.map((pose) => renderFrame(spec, pose, [fw, fh]));
    rendered.forEach((f, i) => {
      if (borderClipped(f.bodyOnly ?? f)) warnings.push(`${id}.${name} frame ${i} touches the frame border`);
    });
    rows.push(rendered);
    meta[name] = { row, frames: n, fps, loop };
    maxCols = Math.max(maxCols, n);
  });
  const sheet = packSheet(fw, fh, rows, maxCols);
  return { sheet, meta, cols: maxCols, rows: rows.length };
}

function portraitFromIdle(idleFrame) {
  // Crop a bust from the idle frame and scale it 2x (nearest) for the UI.
  const crop = new Pix(32, 32);
  crop.blit(idleFrame, -8, -6);
  const out = new Pix(64, 64);
  for (let y = 0; y < 64; y += 1) for (let x = 0; x < 64; x += 1) out.d[y * 64 + x] = crop.get(Math.floor(x / 2), Math.floor(y / 2));
  return out;
}

function main() {
  const t0 = Date.now();
  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const warnings = [];
  const manifest = { version: 1, generator: 'tools/art/gen.mjs', sprites: {}, images: {}, portraits: {} };

  const sheets = buildSheetList();
  for (const entry of sheets) {
    const { sheet, meta, cols, rows } = renderSheet(entry, warnings);
    writePng(entry.file, sheet);
    const key = `${entry.kind}:${entry.id}`;
    manifest.sprites[key] = {
      file: `assets/${entry.file}`,
      frame: entry.spec.frame,
      cols,
      rows,
      anims: meta,
    };
    log(`sprite ${key.padEnd(28)} ${sheet.w}x${sheet.h}`);
    if (entry.kind === 'hero') {
      // Portrait from the idle frame (row 0, col 0).
      const idleFrame = new Pix(entry.spec.frame[0], entry.spec.frame[1]);
      const { default: _unused } = { default: null };
      void _unused;
      for (let y = 0; y < idleFrame.h; y += 1) for (let x = 0; x < idleFrame.w; x += 1) idleFrame.d[y * idleFrame.w + x] = sheet.d[y * sheet.w + x];
      const portrait = portraitFromIdle(idleFrame);
      writePng(`portraits/${entry.id}.png`, portrait);
      manifest.portraits[entry.id] = `assets/portraits/${entry.id}.png`;
    }
  }

  // Backgrounds: far/mid parallax layers and tiling ground per environment.
  const envs = [...new Set(CHAPTERS.map((c) => c.env))];
  for (const env of ENV_IDS) {
    writePng(`bg/${env}-far.png`, farLayer(env));
    writePng(`bg/${env}-mid.png`, midLayer(env));
    writePng(`bg/${env}-ground.png`, groundTile(env));
    manifest.images[`bg-${env}`] = {
      far: `assets/bg/${env}-far.png`, mid: `assets/bg/${env}-mid.png`, ground: `assets/bg/${env}-ground.png`,
    };
  }
  void envs;
  writePng('bg/title.png', titleArt());
  writePng('logo.png', logo('GRAVEMARK'));
  manifest.images.title = 'assets/bg/title.png';
  manifest.images.logo = 'assets/logo.png';

  // Icons.
  const icons = buildIcons();
  for (const [name, pix] of Object.entries(icons)) {
    writePng(`icons/${name}.png`, pix);
    manifest.images[`icon-${name}`] = `assets/icons/${name}.png`;
  }

  writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`\nWrote ${Object.keys(manifest.sprites).length} sprite sheets, ${Object.keys(icons).length} icons in ${Date.now() - t0}ms`);
  if (warnings.length) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const w of warnings.slice(0, 15)) console.warn(`  - ${w}`);
    if (warnings.length > 15) console.warn(`  ...and ${warnings.length - 15} more`);
  }
  void HERO_ANIMS; void C;
}

main();
