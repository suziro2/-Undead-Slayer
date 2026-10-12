import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_IDS, ENEMIES, BOSSES, CHAPTERS } from '../shared/data.js';
import { buildSheetList } from '../tools/art/characters.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const manifest = JSON.parse(readFileSync(join(root, 'assets', 'manifest.json'), 'utf8'));
const pngSize = (file) => {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 1, 4), 'PNG', `${file} is a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

test('one separate sprite sheet per hero, enemy type and boss', () => {
  const files = new Set();
  for (const id of HERO_IDS) files.add(manifest.sprites[`hero:${id}`].file);
  for (const id of Object.keys(ENEMIES)) files.add(manifest.sprites[`mob:${id}`].file);
  for (const id of Object.keys(BOSSES)) files.add(manifest.sprites[`boss:${id}`].file);
  assert.equal(files.size, 10 + Object.keys(ENEMIES).length + 10);
  assert.equal(buildSheetList().length, files.size);
});

test('hero sheets are 48px frames with the required 10 animation rows', () => {
  const required = ['idle', 'walk', 'run', 'attack', 'combo', 'special', 'hit', 'dodge', 'defeat', 'victory'];
  for (const id of HERO_IDS) {
    const s = manifest.sprites[`hero:${id}`];
    assert.deepEqual(s.frame, [48, 48]);
    assert.equal(s.rows, 10);
    assert.deepEqual(Object.keys(s.anims).sort(), [...required].sort());
  }
});

test('enemy sheets have idle, move, attack, special, hit and defeat rows', () => {
  for (const id of Object.keys(ENEMIES)) {
    const s = manifest.sprites[`mob:${id}`];
    assert.deepEqual(Object.keys(s.anims).sort(), ['attack', 'defeat', 'hit', 'idle', 'move', 'special']);
    assert.equal(s.rows, 6);
  }
});

test('boss sheets are 96px frames with the nine required rows', () => {
  const required = ['idle', 'move', 'basic', 'heavy', 'special', 'aoe', 'hit', 'phase', 'defeat'];
  for (const id of Object.keys(BOSSES)) {
    const s = manifest.sprites[`boss:${id}`];
    assert.deepEqual(s.frame, [96, 96]);
    assert.equal(s.rows, 9);
    assert.deepEqual(Object.keys(s.anims).sort(), [...required].sort());
  }
});

test('every sprite sheet exists on disk and matches its declared grid', () => {
  for (const [key, s] of Object.entries(manifest.sprites)) {
    const file = join(root, s.file);
    assert.ok(existsSync(file), `${key} file exists`);
    const { w, h } = pngSize(file);
    assert.equal(w, s.cols * s.frame[0], `${key} width`);
    assert.equal(h, s.rows * s.frame[1], `${key} height`);
    for (const [name, a] of Object.entries(s.anims)) {
      assert.ok(a.row < s.rows && a.row * s.cols + a.frames <= s.cols * s.rows, `${key}.${name} fits the sheet`);
    }
  }
});

test('backgrounds, portraits, icons and logo are present', () => {
  for (const chapter of CHAPTERS) {
    const bg = manifest.images[`bg-${chapter.env}`];
    for (const part of ['far', 'mid', 'ground']) assert.ok(existsSync(join(root, bg[part])), `${chapter.env} ${part}`);
  }
  for (const id of HERO_IDS) assert.ok(existsSync(join(root, manifest.portraits[id])), `portrait ${id}`);
  for (const [k, p] of Object.entries(manifest.images)) if (typeof p === 'string') assert.ok(existsSync(join(root, p)), k);
  assert.ok(existsSync(join(root, manifest.images.logo)));
});
