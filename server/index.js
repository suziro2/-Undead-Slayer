// Entry point: loads configuration from the environment and starts the HTTP server.
import { openDb } from './db.js';
import { createApp } from './app.js';
import { resolve } from 'node:path';

const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT) || 3000,
  dbPath: resolve(process.env.DATABASE_PATH || 'data/undead-slayer.db'),
  // Secure by default (required for SameSite=None cookies in the HTTPS preview). Set COOKIE_SECURE=false
  // only when testing over plain HTTP on a LAN address.
  cookieSecure: process.env.COOKIE_SECURE !== 'false',
  sessionDays: Number(process.env.SESSION_DAYS) || 14,
  trustProxy: process.env.TRUST_PROXY === 'true',
};

const db = openDb(config.dbPath);
const app = createApp({ db, config });
const server = app.listen(config.port, config.host, () => {
  console.log(`Undead Slayer listening on http://${config.host}:${config.port}`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, config };
