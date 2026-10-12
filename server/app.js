// Express application factory: static assets, API routes, and error handling.
import express from 'express';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuthRouter, createProfileRouter, requireAuth } from './auth.js';
import { createGameRouter } from './progress.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const require = createRequire(import.meta.url);

export function createApp({ db, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self'; media-src 'self' blob: data:; object-src 'none'; base-uri 'self'");
    next();
  });

  // Vendor and shared files are served from the project so the browser never reaches a CDN.
  app.get('/vendor/phaser.js', (req, res) => res.sendFile(require.resolve('phaser/dist/phaser.min.js')));
  app.get('/vendor/press-start-2p.woff2', (req, res) => res.sendFile(join(root, 'node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2')));
  app.use('/shared', express.static(join(root, 'shared'), { fallthrough: false, index: false }));
  app.use(express.static(join(root, 'public'), { index: false, dotfiles: 'ignore' }));
  app.use(express.static(join(root, 'client'), { index: false, dotfiles: 'ignore' }));

  app.use('/api', express.json({ limit: '16kb' }));
  // Mutating API calls must send JSON; combined with SameSite=Lax this blocks cross-site form posts.
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const type = req.headers['content-type'] || '';
    if (!type.startsWith('application/json')) return res.status(415).json({ error: 'Requests must be JSON.' });
    next();
  });

  app.use('/api/auth', createAuthRouter(db, config));
  app.use('/api/profile', requireAuth(db), createProfileRouter(db, config));
  app.use('/api', requireAuth(db), createGameRouter(db));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  app.get('/', (req, res) => res.sendFile(join(root, 'client/index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = Number(err.status || err.statusCode) || 500;
    if (status >= 500) console.error(err);
    const payload = { error: status >= 500 ? 'Something went wrong. Please try again.' : err.message };
    if (err.field) payload.field = err.field;
    if (req.path.startsWith('/api')) return res.status(status).json(payload);
    res.status(status).type('text').send(payload.error);
  });

  return app;
}
