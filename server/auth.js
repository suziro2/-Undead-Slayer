// Accounts, sessions, login, registration, and recovery-code password reset.
import { Router } from 'express';
import {
  hashSecret, verifySecret, newSessionToken, hashToken, newRecoveryCode, normalizeRecoveryCode,
  validateUsername, validateEmail, validatePassword, ValidationError, RateLimiter,
} from './security.js';
import { tx } from './db.js';
import { initPlayer, getState } from './economy.js';

export const SESSION_COOKIE = 'us_sid';
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[key] = '';
    }
  }
  return out;
}

export function createSession(db, userId, config) {
  const token = newSessionToken();
  const t = Date.now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, t, t + config.sessionDays * DAY_MS);
  return token;
}

// The game can run inside a cross-site iframe (for example, an HTTPS preview embedded in another
// site). Browsers only send SameSite=None cookies in that context, and they require Secure, so
// HTTPS requests get SameSite=None; Secure. Plain HTTP (local development) keeps SameSite=Lax.
// Lax is still safe on its own: every state-changing route also requires a JSON Content-Type,
// which cross-site forms cannot send without a CORS preflight that the server never allows.
export function isSecureRequest(req, config) {
  return Boolean(config.cookieSecure || req.secure || req.headers['x-forwarded-proto'] === 'https');
}

function cookieAttributes(secure) {
  return secure ? 'SameSite=None; Secure' : 'SameSite=Lax';
}

function sessionCookie(token, config, req) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    cookieAttributes(isSecureRequest(req, config)),
    `Max-Age=${Math.floor(config.sessionDays * 86400)}`,
  ].join('; ');
}

function clearCookie(config, req) {
  return [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', cookieAttributes(isSecureRequest(req, config)), 'Max-Age=0'].join('; ');
}

// The session token comes from the HttpOnly cookie or, as a fallback for embedded previews where
// browsers drop cookies, from an `Authorization: Bearer` header that the client keeps in sessionStorage.
export function sessionToken(req) {
  const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (cookie) return cookie;
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization || '');
  return match ? match[1] : null;
}

// Resolves the session to a user id. Returns null when missing or expired.
export function resolveSession(db, req) {
  const token = sessionToken(req);
  if (!token) return null;
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(hashToken(token));
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    return null;
  }
  return row.user_id;
}

export function requireAuth(db) {
  return (req, res, next) => {
    const userId = resolveSession(db, req);
    if (!userId) return res.status(401).json({ error: 'Please log in to continue.' });
    req.userId = userId;
    next();
  };
}

export function createAuthRouter(db, config) {
  const router = Router();
  // config.rateLimitScale multiplies every limit (tests raise it; production keeps 1).
  const scale = config.rateLimitScale ?? 1;
  const loginLimiter = new RateLimiter({ limit: Math.ceil(10 * scale), windowMs: 15 * 60 * 1000 });
  const registerLimiter = new RateLimiter({ limit: Math.ceil(10 * scale), windowMs: 60 * 60 * 1000 });
  const recoveryLimiter = new RateLimiter({ limit: Math.ceil(8 * scale), windowMs: 15 * 60 * 1000 });
  const tooMany = (res, check) => res.status(429).set('Retry-After', String(check.retryAfter)).json({ error: 'Too many attempts. Please wait and try again.' });
  // A throwaway hash so unknown-user logins cost the same as real ones.
  const dummyHash = hashSecret('dummy-password-for-timing-only-1');

  const userPublic = (row) => ({ id: row.id, username: row.username, email: row.email });

  router.post('/register', (req, res) => {
    const ip = req.ip || 'unknown';
    const rl = registerLimiter.check(`reg:${ip}`);
    if (!rl.ok) return tooMany(res, rl);
    const username = validateUsername(req.body?.username);
    const email = validateEmail(req.body?.email);
    const password = validatePassword(req.body?.password);
    const passwordHash = hashSecret(password);
    const recoveryCode = newRecoveryCode();
    const recoveryHash = hashSecret(normalizeRecoveryCode(recoveryCode));
    const result = tx(db, () => {
      const taken = db.prepare('SELECT username, email FROM users WHERE username = ? OR email = ?').get(username, email);
      if (taken) {
        if (taken.username.toLowerCase() === username.toLowerCase()) throw new ValidationError('That username is already taken.', 'username');
        throw new ValidationError('That email is already registered.', 'email');
      }
      const t = Date.now();
      const info = db.prepare('INSERT INTO users (username, email, password_hash, recovery_hash, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(username, email, passwordHash, recoveryHash, t, t);
      const userId = Number(info.lastInsertRowid);
      initPlayer(db, userId);
      return userId;
    });
    const token = createSession(db, result, config);
    res.set('Set-Cookie', sessionCookie(token, config, req));
    res.status(201).json({ user: userPublic(db.prepare('SELECT * FROM users WHERE id = ?').get(result)), recoveryCode, token, state: getState(db, result) });
  });

  router.post('/login', (req, res) => {
    const identifier = String(req.body?.identifier ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!identifier || !password || identifier.length > 254 || password.length > 128) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const ip = req.ip || 'unknown';
    const key = identifier.toLowerCase();
    const rlIp = loginLimiter.check(`ip:${ip}`);
    const rlUser = loginLimiter.check(`user:${key}`);
    if (!rlIp.ok) return tooMany(res, rlIp);
    if (!rlUser.ok) return tooMany(res, rlUser);
    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE').get(identifier, identifier);
    const ok = verifySecret(password, user ? user.password_hash : dummyHash);
    if (!user || !ok) return res.status(401).json({ error: 'Invalid credentials' });
    loginLimiter.reset(`user:${key}`);
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), user.id);
    const token = createSession(db, user.id, config);
    res.set('Set-Cookie', sessionCookie(token, config, req));
    res.json({ user: userPublic(user), token, state: getState(db, user.id) });
  });

  router.post('/logout', (req, res) => {
    const token = sessionToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    res.set('Set-Cookie', clearCookie(config, req));
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    const userId = resolveSession(db, req);
    if (!userId) return res.json({ user: null });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({ user: userPublic(user), state: getState(db, userId) });
  });

  // Forgot password: identifier + recovery code + new password. Rotates the recovery code
  // and signs out every session for the account.
  router.post('/forgot', (req, res) => {
    const identifier = String(req.body?.identifier ?? '').trim();
    const code = normalizeRecoveryCode(req.body?.recoveryCode);
    const newPassword = validatePassword(req.body?.newPassword);
    if (!identifier) throw new ValidationError('Enter your username or email.', 'identifier');
    const rl = recoveryLimiter.check(`rec:${req.ip}:${identifier.toLowerCase()}`);
    if (!rl.ok) return tooMany(res, rl);
    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE').get(identifier, identifier);
    if (!user || code.length !== 16 || !verifySecret(code, user.recovery_hash)) {
      return res.status(400).json({ error: 'Recovery details are not valid.' });
    }
    const recoveryCode = newRecoveryCode();
    tx(db, () => {
      db.prepare('UPDATE users SET password_hash = ?, recovery_hash = ? WHERE id = ?')
        .run(hashSecret(newPassword), hashSecret(normalizeRecoveryCode(recoveryCode)), user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    });
    res.json({ ok: true, recoveryCode });
  });

  return router;
}

export function createProfileRouter(db, config = {}) {
  const router = Router();
  const limiter = new RateLimiter({ limit: Math.ceil(10 * (config.rateLimitScale ?? 1)), windowMs: 15 * 60 * 1000 });

  // Regenerates the recovery code (requires the current password). Shown once.
  router.post('/recovery-code', (req, res) => {
    const rl = limiter.check(`rc:${req.userId}`);
    if (!rl.ok) return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!verifySecret(String(req.body?.password ?? ''), user.password_hash)) {
      return res.status(400).json({ error: 'Password is incorrect.' });
    }
    const recoveryCode = newRecoveryCode();
    db.prepare('UPDATE users SET recovery_hash = ? WHERE id = ?').run(hashSecret(normalizeRecoveryCode(recoveryCode)), req.userId);
    limiter.reset(`rc:${req.userId}`);
    res.json({ recoveryCode });
  });

  // Changes password and signs out all other sessions (keeps the current one).
  router.post('/password', (req, res) => {
    const rl = limiter.check(`pw:${req.userId}`);
    if (!rl.ok) return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!verifySecret(String(req.body?.currentPassword ?? ''), user.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const newPassword = validatePassword(req.body?.newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashSecret(newPassword), req.userId);
    res.json({ ok: true });
  });

  return router;
}
