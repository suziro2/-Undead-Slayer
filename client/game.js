// Creates the Phaser game. Logical resolution is 640x360 with FIT scaling and
// nearest-neighbour rendering (pixelArt: true, no antialiasing anywhere).
import { BootScene } from './scenes/boot.js';
import { MenuScene } from './scenes/menu.js';
import { AdventureScene } from './scenes/adventure.js';
import { CollectionScene } from './scenes/collection.js';
import { SummonScene } from './scenes/summon.js';
import { UpgradesScene } from './scenes/upgrades.js';
import { InventoryScene } from './scenes/inventory.js';
import { ShopScene } from './scenes/shop.js';
import { ProfileScene } from './scenes/profile.js';
import { SettingsScene } from './scenes/settings.js';
import { BattleScene } from './scenes/battle.js';
import { ResultsScene } from './scenes/results.js';
import { audio } from './systems/audio.js';

export function buildGame() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 640,
    height: 360,
    backgroundColor: '#0b0d18',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    audio: { noAudio: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    scene: [BootScene, MenuScene, AdventureScene, CollectionScene, SummonScene, UpgradesScene,
      InventoryScene, ShopScene, ProfileScene, SettingsScene, BattleScene, ResultsScene],
  });
  // Browsers only allow audio after a gesture; unlock on the first pointer or key press.
  const unlock = () => { audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  // Exposed for automated browser tests (scene inspection); the game does not depend on it.
  window.__gravemarkGame = game;
  return game;
}
