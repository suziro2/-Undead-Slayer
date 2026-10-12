// Password hashing (scrypt), token handling, input validation and rate limiting.
import { scryptSync, randomBytes, timingSafeEqual, createHash, randomInt } from 'node:crypto';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashSecret(secret) {
  const salt = randomBytes(16);
  const key = scryptSync(String(secret), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifySecret(secret, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltHex, keyHex] = parts;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = scryptSync(String(secret), Buffer.from(saltHex, 'hex'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Opaque session tokens; only the SHA-256 hash is stored server-side.
export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// Recovery codes: 16 characters from an unambiguous alphabet, shown once to the player.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newRecoveryCode() {
  let raw = '';
  for (let i = 0; i < 16; i += 1) raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}
export function normalizeRecoveryCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.status = 400;
    this.field = field;
  }
}

export function validateUsername(value) {
  const v = String(value ?? '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(v)) throw new ValidationError('Username must be 3-20 letters, numbers or underscores.', 'username');
  return v;
}

export function validateEmail(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) throw new ValidationError('Enter a valid email address.', 'email');
  return v;
}

export function validatePassword(value) {
  const v = String(value ?? '');
  if (v.length < 8 || v.length > 128) throw new ValidationError('Password must be 8-128 characters.', 'password');
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) throw new ValidationError('Password must include at least one letter and one number.', 'password');
  return v;
}

// Fixed-window in-memory limiter keyed by an arbitrary string.
export class RateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  check(key) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || now > entry.reset) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      return { ok: true };
    }
    entry.count += 1;
    if (entry.count > this.limit) return { ok: false, retryAfter: Math.ceil((entry.reset - now) / 1000) };
    return { ok: true };
  }

  reset(key) {
    this.hits.delete(key);
  }
}
