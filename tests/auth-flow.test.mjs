import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createAuthFlow, normalizeEmail, validatePassword } from '../js/auth-flow.js';
import { createAuthFetch } from '../js/auth-transport.js';

const user = { id: 'test-user', email: 'hello@example.com', email_confirmed_at: '2026-09-08T00:00:00Z', user_metadata: { display_name: 'Asha' } };
const signupUser = { ...user, email_confirmed_at: null, identities: [{ id: 'test-email-identity', provider: 'email' }] };
const session = { user, access_token: 'test-token-never-used-on-network' };
const password = 'river-cloud-papaya-48';
const validSignup = { name: ' Asha ', email: ' Hello@Example.com ', password, confirmation: password, adult: true, boundaries: true };

function setup(enabled = true) {
  let now = 1_000;
  const calls = [];
  const mock = label => Object.fromEntries(['signUp', 'signInWithPassword', 'getSession', 'getUser', 'resend', 'resetPasswordForEmail', 'verifyOtp', 'updateUser', 'signOut'].map(method => [method, async args => {
    calls.push({ client: label, method, args });
    const data = method === 'signUp' ? { user: signupUser, session: null }
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

test('explicit duplicate signup errors offer password sign-in without an OTP challenge', async () => {
  for (const code of ['user_already_exists', 'email_exists']) {
    const { flow, auth, calls } = setup();
    auth.signUp = async () => ({ error: { code, status: 422, message: '<script>private provider detail</script>' } });
    const result = await flow.signup(validSignup);
    assert.equal(result.kind, 'sign-in');
    assert.equal(result.email, user.email);
    assert.match(result.message, /already exists/);
    assert.ok(!result.message.includes('private provider detail'));
    assert.equal(flow.getChallenge(), null);
    await assert.rejects(flow.verify('123456'), { code: 'no_challenge' });
    assert.equal(calls.length, 0, 'Never auto-login, resend, or look up the user');
  }
});

test('sanitized signup responses offer sign-in without claiming verification or email delivery', async () => {
  const { flow, auth, calls } = setup();
  auth.signUp = async () => ({ data: { user: { ...signupUser, identities: [] }, session: null }, error: null });
  const result = await flow.signup(validSignup);
  assert.equal(result.kind, 'sign-in');
  assert.equal(result.email, user.email);
  assert.match(result.message, /may already have an account/);
  assert.match(result.message, /Verify my email/);
  assert.equal(flow.getChallenge(), null);
  assert.equal(flow.resendSeconds(), 60);
  await assert.rejects(flow.resend(), { code: 'no_challenge' });
  await assert.rejects(flow.changePassword(password, password), { code: 'recovery_expired' });
  assert.equal(calls.length, 0);
});

test('missing identity fields are not treated as proof of an existing account', async () => {
  for (const identities of [undefined, null]) {
    const { flow, auth } = setup();
    auth.signUp = async () => ({ data: { user: { ...signupUser, identities }, session: null }, error: null });
    assert.deepEqual(await flow.signup(validSignup), { kind: 'signup', email: user.email });
  }
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

test('the OTP form supports six-digit rollout and existing eight-digit codes without truncation', async () => {
  const html = await readFile(new URL('../account.html', import.meta.url), 'utf8');
  const input = html.match(/<input\b[^>]*\bid="otp-code"[^>]*>/)?.[0];
  assert.ok(input, 'The shared signup/recovery OTP field must exist');
  const attribute = name => input.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  const pattern = new RegExp(`^(?:${attribute('pattern')})$`);
  assert.equal(attribute('minlength'), '6');
  assert.equal(attribute('maxlength'), '8');
  assert.equal(attribute('autocomplete'), 'one-time-code');
  assert.equal(attribute('placeholder'), '000000');
  for (const token of ['', '1234', '12345', '1234567', '123456789', 'abc123', 'abcdefgh', '１２３４５６']) assert.ok(!pattern.test(token));
  for (const token of ['012345', '01234567']) {
    assert.ok(pattern.test(token));
    for (const kind of ['signup', 'recovery']) {
      const { flow, calls } = setup();
      if (kind === 'signup') await flow.signup(validSignup);
      else await flow.requestRecovery(user.email);
      const result = await flow.verify(token);
      assert.equal(result.kind, kind);
      assert.equal(calls.at(-1).args.token, token);
      assert.equal(calls.at(-1).args.type, kind === 'signup' ? 'email' : 'recovery');
    }
  }
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
  for (const token of ['', '1234', '12345', '1234567', '123456789', '123 45', '1234 678', 'abcdef', 'abcdefgh', '１２３４５６', '１２３４５６７８']) await assert.rejects(flow.verify(token), { code: 'otp' });
  assert.equal(calls.filter(c => c.method === 'verifyOtp').length, 0);
  recoveryAuth.verifyOtp = async () => ({ error: { code: 'otp_expired', status: 403 } });
  for (const token of ['123456', '12345678']) {
    await assert.rejects(flow.verify(token), { code: 'invalid_code' });
    await assert.rejects(flow.changePassword(password, password), { code: 'recovery_expired' });
  }
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
  assert.equal(flow.resendSeconds(), 60);
  await assert.rejects(flow.resend(), { code: 'resend_wait' });
});

test('an initial send rejection starts a cooldown without inventing an OTP challenge', async () => {
  for (const operation of ['signup', 'requestSignupCode', 'requestRecovery']) {
    const { flow, auth, recoveryAuth, tick } = setup();
    const limited = async () => ({ error: { status: 429, code: 'over_email_send_rate_limit' } });
    auth.signUp = auth.resend = recoveryAuth.resetPasswordForEmail = limited;
    await assert.rejects(flow[operation](operation === 'signup' ? validSignup : user.email), { code: 'rate_limit' });
    assert.equal(flow.getChallenge(), null);
    assert.equal(flow.resendSeconds(), 60);
    flow.deferEmailRequests(180);
    flow.deferEmailRequests(1);
    assert.equal(flow.resendSeconds(), 180);
    tick(60_000);
    await assert.rejects(flow.requestRecovery(user.email), error => error.code === 'resend_wait' && error.message.includes('120'));
  }
});

test('SMTP/service errors never produce a successful email challenge or expose provider details', async () => {
  const { flow, auth, recoveryAuth } = setup();
  const unavailable = async () => ({ error: { status: 500, code: 'unexpected_failure', message: 'private SMTP detail' } });
  auth.resend = recoveryAuth.resetPasswordForEmail = unavailable;
  await assert.rejects(flow.requestSignupCode(user.email), error => error.code === 'email_delivery' && !error.message.includes('private'));
  await assert.rejects(flow.requestRecovery(user.email), { code: 'email_delivery' });
  assert.equal(flow.getChallenge(), null);
});

test('HTTP diagnostics preserve the response and reveal only fixed operation names and statuses', async () => {
  const events = [];
  const response = new Response(JSON.stringify({ access_token: 'fixture-response-secret' }), { status: 200 });
  const input = 'https://auth.example.com/auth/v1/verify?token=fixture-query-secret';
  const init = { method: 'POST', headers: { Authorization: 'fixture-header-secret' }, body: JSON.stringify({ email: user.email, token: 'fixture-body-secret' }) };
  const tracedFetch = createAuthFetch({ supabaseUrl: 'https://auth.example.com', report: event => events.push(event), fetchImpl: async (url, options) => {
    assert.equal(url, input);
    assert.equal(options, init);
    return response;
  } });
  assert.equal(await tracedFetch(input, init), response);
  assert.equal(response.bodyUsed, false);
  assert.deepEqual(events, [{ operation: 'verify_code', status: 200 }]);
  const failure = new TypeError('fixture-network-secret');
  const failedFetch = createAuthFetch({ supabaseUrl: 'https://auth.example.com', report: event => events.push(event), fetchImpl: async () => { throw failure; } });
  await assert.rejects(failedFetch(input), error => error === failure);
  assert.deepEqual(events.at(-1), { operation: 'verify_code', status: 0 });
  assert.ok(!JSON.stringify(events).includes('secret'));
  assert.ok(!JSON.stringify(events).includes(user.email));
});

test('email HTTP rate limits honor Retry-After without reading response bodies or affecting other hosts', async () => {
  const waits = [];
  const events = [];
  let retryAfter = '180';
  const fetchImpl = async () => new Response('{}', { status: 429, headers: { 'Retry-After': retryAfter } });
  const tracedFetch = createAuthFetch({ supabaseUrl: 'https://auth.example.com', fetchImpl, report: event => events.push(event), onSendRateLimit: value => waits.push(value), clock: () => 0 });
  await tracedFetch(new Request('https://auth.example.com/auth/v1/resend'));
  assert.deepEqual(waits, [180]);
  retryAfter = 'Thu, 01 Jan 1970 00:02:00 GMT';
  await tracedFetch('https://auth.example.com/auth/v1/recover');
  assert.equal(waits.at(-1), 120);
  retryAfter = 'invalid';
  await tracedFetch('https://auth.example.com/auth/v1/signup');
  assert.equal(waits.at(-1), 60);
  await tracedFetch('https://other.example.com/auth/v1/resend');
  assert.equal(waits.length, 3);
  assert.equal(events.length, 3);
  const silentFetch = createAuthFetch({ supabaseUrl: 'https://auth.example.com', fetchImpl, report: () => { throw new Error('logger'); }, onSendRateLimit: () => { throw new Error('observer'); } });
  assert.equal((await silentFetch('https://auth.example.com/auth/v1/resend')).status, 429);
});

test('the vendored SDK sends the expected signup, resend, verify and recovery HTTP requests', async () => {
  const source = await readFile(new URL('../assets/vendor/supabase-2.116.0.js', import.meta.url), 'utf8');
  const context = vm.createContext({ URL, console, setTimeout, clearTimeout, setInterval, clearInterval, fetch, Headers, Request, Response, AbortController, TextEncoder, TextDecoder, WebSocket: globalThis.WebSocket, crypto: globalThis.crypto });
  vm.runInContext(source, context);
  const requests = [];
  let signupReply = signupUser;
  let signupError = null;
  const fetchImpl = async (input, init) => {
    const path = new URL(input).pathname;
    requests.push({ path, method: init.method, body: JSON.parse(init.body ?? '{}') });
    if (path.endsWith('/signup') && signupError) return new Response(JSON.stringify(signupError), { status: 422, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });
    if (path.endsWith('/verify')) return new Response(JSON.stringify({ code: 'otp_expired', msg: 'Token has expired or is invalid' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const body = path.endsWith('/signup') ? signupReply : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const client = storageKey => context.supabase.createClient('https://auth.example.com', 'public-fixture-key', {
    global: { fetch: createAuthFetch({ supabaseUrl: 'https://auth.example.com', fetchImpl }) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey },
  }).auth;
  let now = 0;
  const flow = createAuthFlow({ auth: client('fixture.main'), recoveryAuth: client('fixture.recovery'), enabled: true, clock: () => now });
  await flow.signup(validSignup);
  assert.equal(requests.at(-1).path, '/auth/v1/signup');
  assert.equal(requests.at(-1).body.email, user.email);
  assert.equal(requests.at(-1).body.password, password);
  now += 60_000;
  await flow.resend();
  assert.equal(requests.at(-1).path, '/auth/v1/resend');
  assert.equal(requests.at(-1).body.type, 'signup');
  assert.equal(requests.at(-1).body.email, user.email);
  for (const token of ['012345', '01234567']) {
    await assert.rejects(flow.verify(token), { code: 'invalid_code' });
    assert.equal(requests.at(-1).path, '/auth/v1/verify');
    assert.equal(requests.at(-1).body.type, 'email');
    assert.equal(requests.at(-1).body.token, token);
    assert.equal(requests.at(-1).body.email, user.email);
  }
  now += 60_000;
  await flow.requestRecovery(user.email);
  assert.equal(requests.at(-1).path, '/auth/v1/recover');
  assert.equal(requests.at(-1).body.email, user.email);
  for (const token of ['012345', '01234567']) {
    await assert.rejects(flow.verify(token), { code: 'invalid_code' });
    assert.equal(requests.at(-1).body.type, 'recovery');
    assert.equal(requests.at(-1).body.token, token);
  }
  assert.ok(requests.every(request => request.method === 'POST'));
  now += 60_000;
  signupReply = { ...signupUser, identities: [] };
  const beforeDuplicate = requests.length;
  assert.equal((await flow.signup(validSignup)).kind, 'sign-in');
  assert.equal(requests.length, beforeDuplicate + 1);
  assert.equal(requests.at(-1).path, '/auth/v1/signup');
  assert.equal(flow.getChallenge(), null);
  now += 60_000;
  signupError = { code: 'user_already_exists', msg: 'User already registered' };
  assert.equal((await flow.signup(validSignup)).kind, 'sign-in');
  assert.equal(flow.getChallenge(), null);
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
