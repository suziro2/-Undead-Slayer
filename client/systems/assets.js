// Asset manifest handling: which textures exist and how sprite sheets map to animations.
export const sheetKey = (kind, id) => `sheet-${kind}-${id}`;
export const animKey = (kind, id, anim) => `${kind}-${id}-${anim}`;

export async function fetchManifest() {
  const res = await fetch('/assets/manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Manifest request failed (${res.status})`);
  return res.json();
}

// Registers every texture the game needs with a loader, returns the list of keys.
export function queueAssets(loader, manifest, { only } = {}) {
  const queued = [];
  for (const [id, info] of Object.entries(manifest.sprites)) {
    const [kind, name] = id.split(':');
    if (only && !only.includes(name)) continue;
    const key = sheetKey(kind, name);
    if (loader.scene.textures.exists(key)) continue;
    loader.spritesheet(key, `/${info.file}`, { frameWidth: info.frame[0], frameHeight: info.frame[1] });
    queued.push(key);
  }
  for (const [key, path] of Object.entries(manifest.images)) {
    if (typeof path === 'string') {
      if (loader.scene.textures.exists(key)) continue;
      loader.image(key, `/${path}`);
      queued.push(key);
    } else {
      for (const [part, p] of Object.entries(path)) {
        const k = `${key}-${part}`;
        if (loader.scene.textures.exists(k)) continue;
        loader.image(k, `/${p}`);
        queued.push(k);
      }
    }
  }
  for (const [id, p] of Object.entries(manifest.portraits)) {
    const key = `portrait-${id}`;
    if (loader.scene.textures.exists(key)) continue;
    loader.image(key, `/${p}`);
    queued.push(key);
  }
  return queued;
}

// Creates Phaser animations for each sheet using the manifest row layout.
export function createAnims(scene, manifest) {
  for (const [id, info] of Object.entries(manifest.sprites)) {
    const [kind, name] = id.split(':');
    const tex = sheetKey(kind, name);
    if (!scene.textures.exists(tex)) continue;
    for (const [anim, a] of Object.entries(info.anims)) {
      const key = animKey(kind, name, anim);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(tex, { start: a.row * info.cols, end: a.row * info.cols + a.frames - 1 }),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }
}

export function animDuration(manifest, kind, id, anim) {
  const info = manifest.sprites[`${kind}:${id}`];
  const a = info?.anims[anim];
  return a ? a.frames / a.fps : 0.5;
}
