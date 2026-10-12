import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashSecret, verifySecret, newSessionToken, hashToken, newRecoveryCode, normalizeRecoveryCode,
  validateUsername, validateEmail, validatePassword, ValidationError, RateLimiter,
} from '../server/security.js';

test('passwords are hashed with scrypt and salted, never stored in plain text', () => {
  const h1 = hashSecret('hunter22a');
  const h2 = hashSecret('hunter22a');
  assert.notEqual(h1, h2, 'salt makes hashes differ');
  assert.ok(h1.startsWith('scrypt$16384$8$1$'));
  assert.ok(!h1.includes('hunter22a'));
  assert.equal(verifySecret('hunter22a', h1), true);
  assert.equal(verifySecret('hunter22b', h1), false);
  assert.equal(verifySecret('x', 'not-a-hash'), false);
  assert.equal(verifySecret('x', undefined), false);
});

test('session tokens are random and stored only as SHA-256 hashes', () => {
  const t = newSessionToken();
  assert.ok(t.length >= 40);
  assert.notEqual(newSessionToken(), t);
  assert.equal(hashToken(t).length, 64);
  assert.notEqual(hashToken(t), t);
});

test('recovery codes use an unambiguous alphabet and normalise input', () => {
  const code = newRecoveryCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeRecoveryCode(code.toLowerCase()), code.replace(/-/g, ''));
});

test('username rules: 3-20 chars of letters, digits and underscore', () => {
  assert.equal(validateUsername(' Slayer_1 '), 'Slayer_1');
  for (const bad of ['ab', 'x'.repeat(21), 'has space', 'emoji😀', 'dash-name', '']) {
    assert.throws(() => validateUsername(bad), ValidationError, bad);
  }
});

test('email rules and password rules', () => {
  assert.equal(validateEmail('Player@Example.COM'), 'player@example.com');
  assert.throws(() => validateEmail('nope'), ValidationError);
  assert.throws(() => validateEmail('a b@c.de'), ValidationError);
  assert.equal(validatePassword('abcdefg1'), 'abcdefg1');
  assert.throws(() => validatePassword('short1'), ValidationError);
  assert.throws(() => validatePassword('onlyletters'), ValidationError);
  assert.throws(() => validatePassword('12345678'), ValidationError);
  assert.throws(() => validatePassword('a1' + 'x'.repeat(130)), ValidationError);
});

test('rate limiter blocks after the limit and resets on demand', () => {
  const rl = new RateLimiter({ limit: 2, windowMs: 60000 });
  assert.equal(rl.check('k').ok, true);
  assert.equal(rl.check('k').ok, true);
  const third = rl.check('k');
  assert.equal(third.ok, false);
  assert.ok(third.retryAfter > 0);
  rl.reset('k');
  assert.equal(rl.check('k').ok, true);
});
