// Bootstraps the app: checks the session, shows the auth overlay when needed,
// then creates the Phaser game with all scenes.
import { api, get } from './api.js';
import { session } from './session.js';
import { showAuth } from './auth-ui.js';
import { buildGame } from './game.js';

async function start() {
  let payload = null;
  try {
    payload = await get('/api/auth/me');
  } catch {
    payload = { user: null };
  }
  if (!payload?.state) {
    payload = await showAuth();
  }
  session.apply(payload);
  buildGame();
  document.querySelector('#game-root').dataset.ready = '1';
}

// Signing out reloads the page: the overlay appears and no game state survives in memory.
window.addEventListener('gravemark:logout', async () => {
  try { await api('POST', '/api/auth/logout'); } catch { /* session may already be gone */ }
  window.location.reload();
});

start();
