// Bootstraps the app. The Phaser game starts first so the loading screen shows real progress;
// the boot scene checks the session and shows the login overlay once assets are loaded.
import { api } from './api.js';
import { buildGame } from './game.js';

// Signing out reloads the page: the loading screen runs again and the login overlay appears.
window.addEventListener('gravemark:logout', async () => {
  try { await api('POST', '/api/auth/logout'); } catch { /* session may already be gone */ }
  window.location.reload();
});

// The session ended while playing (for example, a stale token). Reload so the loading screen
// runs again and the login overlay appears, instead of leaving an error on screen.
window.addEventListener('gravemark:session-expired', () => window.location.reload());

fetch('/api/health')
  .then((r) => r.json())
  .then((d) => { document.querySelector('#build-label').textContent = `build ${d.build}`; })
  .catch(() => { /* label is optional */ });

buildGame();
document.querySelector('#game-root').dataset.ready = '1';
