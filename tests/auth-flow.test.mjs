import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createAuthFlow, normalizeEmail, validatePassword } from '../js/auth-flow.js';

const user = { id: 'test-user', email: 'hello@example.com', email_confirmed_at: '2026-09-08T00:00:00Z', user_metadata: { display_name: 'Asha' } };
const session = { user, access_token: 'test-token-never-used-on-network' };
const password = 'river-cloud-papaya-48';
const validSignup = { name: ' Asha ', email: ' Hello@Example.com ', password, confirmation: password, adult: true, boundaries: true };

function setup(enabled = true) {
  let now = 1_000;
  const calls = [];
  const mock = label => Object.fromEntries(['signUp', 'signInWithPassword', 'getSession', 'getUser', 'resend', 'resetPasswordForEmail', 'verifyOtp', 'updateUser', 'signOut'].map(method => [method, async args => {
    calls.push({ client: label, method, args });
    const data = method === 'signUp' ? { user, session: null }
      : method === 'getSession' ? { session: null }
        : method === 'getUser' ? { user }
          : method === 'verifyOtp' ? { user, session } : {};
    return { data, error: null };
  }]));
  const auth = mock('main');
  const recoveryAuth = mock('recovery');
  const flow = createAuthFlow({ auth, recoveryAuth, enabled, clock: () => now });
  return { flow, auth, recoveryAuth, calls, tick: ms => { now += ms; } };
}

test('closed enrollment cannot call auth even when a form is submitted programmatically', async () => {
  const { flow, calls } = setup(false);
  await assert.rejects(flow.signup(validSignup), { code: 'not_open' });
  await assert.rejects(flow.login({ email: user.email, password }), { code: 'not_open' });
  await assert.rejects(flow.requestRecovery(user.email), { code: 'not_open' });
  assert.equal(calls.length, 0);
});

test('email normalization rejects malformed input, and password whitespace is preserved', () => {
  assert.equal(normalizeEmail(' Hello@Example.com '), user.email);
  for (const email of ['someone', 'a b@example.com', '@example.com', 'a@', 'a'.repeat(255) + '@example.com']) {
    assert.throws(() => normalizeEmail(email), { code: 'email' });
  }
  assert.equal(validatePassword('  never trim my pass  '), '  never trim my pass  ');
  assert.throws(() => validatePassword('too short'), { code: 'password' });
  assert.throws(() => validatePassword('a'.repeat(129)), { code: 'password' });
  assert.throws(() => validatePassword(password, 'different-password'), { code: 'password_match' });
});

test('signup requires the adult declaration and boundaries before any API call', async () => {
  const { flow, calls } = setup();
  await assert.rejects(flow.signup({ ...validSignup, adult: false }), { code: 'adult' });
  await assert.rejects(flow.signup({ ...validSignup, boundaries: false }), { code: 'boundaries' });
  await assert.rejects(flow.signup({ ...validSignup, name: '' }), { code: 'name' });
  assert.equal(calls.length, 0);
});

test('signup uses email and password; metadata grants no role or verified age', async () => {
  const { flow, calls } = setup();
  assert.deepEqual(await flow.signup(validSignup), { kind: 'signup', email: user.email });
  assert.equal(calls[0].method, 'signUp');
  assert.equal(calls[0].args.email, user.email);
  assert.equal(calls[0].args.password, password);
  assert.deepEqual(calls[0].args.options.data, { display_name: 'Asha', adult_declaration: true, community_rules_version: '2026-09-08' });
});

test('unexpected automatic email confirmation does not enter the account screen', async () => {
  const { flow, auth, calls } = setup();
  auth.signUp = async () => ({ data: { user, session }, error: null });
  await assert.rejects(flow.signup(validSignup), { code: 'confirmation_required' });
  assert.equal(calls.at(-1).method, 'signOut');
  assert.equal(flow.getChallenge(), null);
});

test('signup verifies an email OTP while signup resend never starts a passwordless signup', async () => {
  const { flow, calls, tick } = setup();
  await flow.signup(validSignup);
  tick(60_000);
  await flow.resend();
  assert.deepEqual(calls.at(-1).args, { type: 'signup', email: user.email });
  assert.deepEqual(await flow.verify('123456'), { kind: 'signup', user });
  assert.deepEqual(calls.at(-1).args, { email: user.email, token: '123456', type: 'email' });
});

test('login verifies the server user and does not apply a new password policy to old passwords', async () => {
  const { flow, calls } = setup();
  assert.deepEqual(await flow.login({ email: user.email, password: 'old-short' }), user);
  assert.deepEqual(calls.map(c => c.method), ['signInWithPassword', 'getUser']);
});

test('stored session identity alone is never used as the verified account identity', async () => {
  const { flow, auth, calls } = setup();
  auth.getSession = async () => ({ data: { session: { user: { id: 'tampered' } } }, error: null });
  assert.deepEqual(await flow.currentUser(), user);
  assert.equal(calls.at(-1).method, 'getUser');
});

test('invalid credentials and arbitrary provider content produce safe UI errors', async () => {
  const { flow, auth } = setup();
  auth.signInWithPassword = async () => ({ error: { code: 'invalid_credentials', message: '<script>bad</script>' } });
  await assert.rejects(flow.login({ email: user.email, password }), error => error.code === 'invalid_credentials' && !error.message.includes('<script>'));
  auth.signInWithPassword = async () => { throw new TypeError('fetch failed with private details'); };
  await assert.rejects(flow.login({ email: user.email, password }), error => error.code === 'unavailable' && !error.message.includes('private details'));
});

test('recovery always uses its separate client and a recovery challenge', async () => {
  const { flow, calls } = setup();
  assert.deepEqual(await flow.requestRecovery(user.email), { kind: 'recovery', email: user.email });
  assert.deepEqual(calls[0], { client: 'recovery', method: 'resetPasswordForEmail', args: user.email });
  await flow.verify('012345');
  assert.deepEqual(calls.at(-1), { client: 'recovery', method: 'verifyOtp', args: { email: user.email, token: '012345', type: 'recovery' } });
});

test('a normal signed-in user cannot bypass recovery verification', async () => {
  const { flow, calls } = setup();
  await flow.login({ email: user.email, password });
  await assert.rejects(flow.changePassword(password, password), { code: 'recovery_expired' });
  assert.equal(calls.filter(c => c.method === 'updateUser').length, 0);
});

test('invalid OTP format, a missing challenge and a wrong code cannot authorize a password change', async () => {
  const { flow, calls, recoveryAuth } = setup();
  await assert.rejects(flow.verify('123456'), { code: 'no_challenge' });
  await flow.requestRecovery(user.email);
  for (const token of ['12345', '1234567', '123 45', 'abcdef']) await assert.rejects(flow.verify(token), { code: 'otp' });
  assert.equal(calls.filter(c => c.method === 'verifyOtp').length, 0);
  recoveryAuth.verifyOtp = async () => ({ error: { code: 'otp_expired', status: 403 } });
  await assert.rejects(flow.verify('123456'), { code: 'invalid_code' });
  await assert.rejects(flow.changePassword(password, password), { code: 'recovery_expired' });
});

test('network failure during OTP verification is not described as a wrong code', async () => {
  const { flow, recoveryAuth } = setup();
  await flow.requestRecovery(user.email);
  recoveryAuth.verifyOtp = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(flow.verify('123456'), { code: 'unavailable' });
});

test('resend has a one-minute cooldown and server rate limits remain authoritative', async () => {
  const { flow, tick, recoveryAuth } = setup();
  await flow.requestRecovery(user.email);
  assert.equal(flow.resendSeconds(), 60);
  await assert.rejects(flow.resend(), { code: 'resend_wait' });
  await assert.rejects(flow.requestRecovery('other@example.com'), { code: 'resend_wait' });
  tick(59_999);
  assert.equal(flow.resendSeconds(), 1);
  tick(1);
  await flow.resend();
  assert.equal(flow.resendSeconds(), 60);
  tick(60_000);
  recoveryAuth.resetPasswordForEmail = async () => ({ error: { status: 429 } });
  await assert.rejects(flow.resend(), { code: 'rate_limit' });
});

test('recovery grants expire and canceling a flow removes the grant', async () => {
  const { flow, tick } = setup();
  await flow.requestRecovery(user.email);
  await flow.verify('123456');
  tick(600_000);
  await assert.rejects(flow.changePassword(password, password), { code: 'recovery_expired' });
  await flow.requestRecovery(user.email);
  await flow.verify('123456');
  await flow.cancelChallenge();
  await assert.rejects(flow.changePassword(password, password), { code: 'recovery_expired' });
});

test('successful recovery updates once, requests global sign-out and clears local sessions', async () => {
  const { flow, calls } = setup();
  await flow.requestRecovery(user.email);
  await flow.verify('123456');
  assert.deepEqual(await flow.changePassword(password, password), { sessionsRevoked: true });
  assert.deepEqual(calls.filter(c => c.method === 'updateUser'), [{ client: 'recovery', method: 'updateUser', args: { password } }]);
  assert.deepEqual(calls.filter(c => c.method === 'signOut').map(c => [c.client, c.args.scope]), [['recovery', 'global'], ['recovery', 'local'], ['main', 'local']]);
  await assert.rejects(flow.changePassword(password, password), { code: 'recovery_expired' });
});

test('failed password updates can be corrected, while failed sign-out cannot falsely undo a successful reset', async () => {
  const { flow, recoveryAuth } = setup();
  await flow.requestRecovery(user.email);
  await flow.verify('123456');
  recoveryAuth.updateUser = async () => ({ error: { code: 'same_password' } });
  await assert.rejects(flow.changePassword(password, password), { code: 'same_password' });
  recoveryAuth.updateUser = async () => ({ data: { user }, error: null });
  recoveryAuth.signOut = async () => ({ error: new Error('unavailable') });
  assert.deepEqual(await flow.changePassword(password, password), { sessionsRevoked: false });
  await assert.rejects(flow.changePassword(password, password), { code: 'recovery_expired' });
});

test('the exact vendored browser SDK exposes createClient as a classic script', async () => {
  const source = await readFile(new URL('../assets/vendor/supabase-2.116.0.js', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../assets/vendor/manifest.json', import.meta.url), 'utf8'));
  assert.equal(createHash('sha256').update(source).digest('hex'), manifest.sha256);
  const context = vm.createContext({ URL, console, setTimeout, clearTimeout, setInterval, clearInterval, fetch, Headers, Request, Response, AbortController, TextEncoder, TextDecoder, crypto: globalThis.crypto });
  vm.runInContext(source, context);
  assert.equal(typeof context.supabase.createClient, 'function');
});
