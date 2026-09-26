import { authConfig } from './auth-config.js?v=20260926-1';
import { createAuthFlow } from './auth-flow.js?v=20260926-1';
import { createAuthFetch } from './auth-transport.js?v=20260926-1';

const panels = [...document.querySelectorAll('[data-panel]')];
const tabs = document.querySelector('#account-tabs');
const status = document.querySelector('#account-status');
const notice = document.querySelector('#launch-notice');
const resendButton = document.querySelector('#resend-code');
const signoutButton = document.querySelector('#signout');
const publicRoutes = new Set(['login', 'signup', 'forgot', 'verify-email']);
let flow = null;
let busy = false;
let activePanel = 'login';

document.querySelector('#account-year').textContent = new Date().getFullYear();

function announce(message = '', tone = 'info', focus = false) {
  status.textContent = message;
  status.dataset.tone = tone;
  if (focus && message) status.focus();
}

function clearSecrets() {
  document.querySelectorAll('input[name="password"], input[name="confirmation"], #otp-code').forEach(input => {
    input.value = '';
    if (input.id !== 'otp-code') input.type = 'password';
  });
  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.textContent = 'Show';
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('aria-pressed', 'false');
  });
}

function showPanel(name, { focus = true } = {}) {
  if (!panels.some(panel => panel.dataset.panel === name)) name = 'login';
  activePanel = name;
  panels.forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
  tabs.hidden = ['otp', 'new-password', 'account'].includes(name);
  tabs.querySelectorAll('a').forEach(link => {
    if (link.dataset.route === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  history.replaceState(null, '', '#' + name);
  announce();
  if (focus) document.querySelector(`[data-panel="${name}"] h2`)?.focus();
  updateResend();
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('form fieldset').forEach(fieldset => {
    fieldset.disabled = busy || !flow || !authConfig.accountsEnabled;
  });
  document.querySelectorAll('form').forEach(form => form.setAttribute('aria-busy', String(value)));
  signoutButton.disabled = busy || !flow;
  updateResend();
}

function updateResend() {
  const remaining = flow?.resendSeconds() ?? 0;
  resendButton.disabled = busy || !flow || activePanel !== 'otp' || remaining > 0;
  document.querySelector('#resend-countdown').textContent = activePanel === 'otp' && remaining > 0 ? `Available in ${remaining}s` : '';
  document.querySelectorAll('[data-email-send]').forEach(button => {
    button.disabled = busy || !flow || remaining > 0;
  });
  document.querySelectorAll('[data-email-countdown]').forEach(hint => {
    hint.textContent = remaining > 0 ? `Please wait ${remaining}s before requesting another email. Provider limits may last longer.` : '';
  });
}

function renderOtp(pending) {
  const recovery = pending.kind === 'recovery';
  document.querySelector('#otp-title').textContent = recovery ? 'Check your inbox.' : 'Verify your email.';
  document.querySelector('#otp-explanation').textContent = recovery
    ? 'A password reset code is sent only if this email belongs to an eligible account. Check your inbox and spam folder, then enter the latest code below.'
    : 'Signup codes are sent only while your email is waiting for verification. If you already verified it, sign in with your password instead.';
  document.querySelector('#signup-code-help').hidden = recovery;
  document.querySelector('#otp-destination').textContent = pending.email;
  showPanel('otp');
  clearSecrets();
}

function renderAccount(user) {
  // User metadata is display-only. Never use it for roles or verification badges.
  const name = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name.trim().slice(0, 60) : 'friend';
  document.querySelector('#account-name').textContent = name || 'friend';
  document.querySelector('#account-email').textContent = user.email ?? '';
  showPanel('account');
  clearSecrets();
}

async function run(task, loadingMessage) {
  if (busy) return;
  if (!flow) {
    announce('Accounts are coming soon. You can keep exploring Sathivo while email verification is being prepared.', 'info', true);
    return;
  }
  setBusy(true);
  announce(loadingMessage);
  try { await task(); }
  catch (error) {
    if (error.code === 'recovery_expired') {
      await flow.cancelChallenge();
      showPanel('forgot');
      clearSecrets();
    }
    announce(error.message || 'We could not complete that request. Please try again.', 'error', true);
  } finally { setBusy(false); }
}

function bindForm(id, task, loadingMessage) {
  const form = document.querySelector(id);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    if (!form.reportValidity()) {
      if (id === '#otp-form') announce('Enter the 6- or 8-digit code from your email.', 'error', true);
      return;
    }
    // Capture values before the fieldset becomes disabled.
    const values = Object.fromEntries(new FormData(form));
    void run(() => task(values, form), loadingMessage);
  });
}

bindForm('#login-form', async values => {
  renderAccount(await flow.login(values));
}, 'Signing you in…');

bindForm('#signup-form', async values => {
  const result = await flow.signup({ ...values, adult: values.adult === 'on', boundaries: values.boundaries === 'on' });
  if (result.kind === 'sign-in') {
    document.querySelector('#login-email').value = result.email;
    showPanel('login');
    clearSecrets();
    announce(result.message, 'info', true);
    return;
  }
  renderOtp(result);
}, 'Preparing your email verification…');

bindForm('#recovery-form', async values => {
  renderOtp(await flow.requestRecovery(values.email));
}, 'Requesting your reset code…');

bindForm('#verification-form', async values => {
  renderOtp(await flow.requestSignupCode(values.email));
}, 'Requesting your verification code…');

bindForm('#otp-form', async values => {
  try {
    const result = await flow.verify(values.code);
    if (result.kind === 'recovery') showPanel('new-password');
    else renderAccount(result.user);
  } finally { document.querySelector('#otp-code').value = ''; }
}, 'Checking your code…');

bindForm('#password-form', async values => {
  const result = await flow.changePassword(values.password, values.confirmation);
  clearSecrets();
  showPanel('login');
  announce(result.sessionsRevoked
    ? 'Your password has been changed. Sign in with your new password.'
    : 'Your password has been changed, but we could not confirm sign-out on every device. Sign out on any other devices you use.',
  result.sessionsRevoked ? 'success' : 'info', true);
}, 'Saving your new password…');

resendButton.addEventListener('click', () => void run(async () => {
  await flow.resend();
  document.querySelector('#otp-code').value = '';
  announce(flow.getChallenge()?.kind === 'recovery'
    ? 'Request completed. Eligible accounts receive a reset code; use the latest email and check spam too.'
    : 'Request completed. Already verified? No signup code will be sent. Choose “Sign in with password” or “Forgot password?” above.', 'info', true);
}, 'Requesting another code…'));

signoutButton.addEventListener('click', () => void run(async () => {
  await flow.logout();
  clearSecrets();
  document.querySelector('#account-name').textContent = 'friend';
  document.querySelector('#account-email').textContent = '';
  showPanel('login');
  announce('You have signed out on this device.', 'success');
}, 'Signing you out…'));

document.querySelectorAll('[data-toggle-password]').forEach(button => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed', String(show));
  });
});

document.querySelectorAll('[data-route]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    if (busy) return;
    const pendingEmail = flow?.getChallenge()?.email
      || (activePanel === 'signup' ? document.querySelector('#signup-email').value.trim() : '')
      || (activePanel === 'login' ? document.querySelector('#login-email').value.trim() : '');
    if (pendingEmail && link.dataset.route === 'login') document.querySelector('#login-email').value = pendingEmail;
    if (pendingEmail && link.dataset.route === 'forgot') document.querySelector('#recovery-email').value = pendingEmail;
    if (pendingEmail && link.dataset.route === 'verify-email') document.querySelector('#verification-email').value = pendingEmail;
    clearSecrets();
    // Immediately clear the recovery grant before changing screens.
    if (flow) void flow.cancelChallenge();
    showPanel(link.dataset.route);
  });
});

window.addEventListener('hashchange', () => {
  const name = location.hash.slice(1);
  if (name === 'account-boundaries') {
    document.querySelector('#account-boundaries').open = true;
    return;
  }
  if (busy) { history.replaceState(null, '', '#' + activePanel); return; }
  if (!publicRoutes.has(name)) { history.replaceState(null, '', '#' + activePanel); return; }
  if (flow) void flow.cancelChallenge();
  clearSecrets();
  showPanel(name);
});

// The application accepts typed OTPs only. Never restore sessions from a URL.
const initialRoute = location.hash.slice(1);
const hadTokenUrl = /access_token|refresh_token|token_hash|[?&]code=/.test(location.hash + location.search);
if (location.search || hadTokenUrl) history.replaceState(null, '', location.pathname + '#login');
showPanel(publicRoutes.has(initialRoute) ? initialRoute : 'login', { focus: false });
if (hadTokenUrl) announce('Use the verification code from your email on this page. Request a fresh code to continue.', 'info');

async function initialize() {
  if (!authConfig.accountsEnabled) return;
  try {
    // Load the vendored browser bundle as a classic script: its `var supabase`
    // belongs on window, not in an ES module's private scope.
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../assets/vendor/supabase-2.116.0.js', import.meta.url).href;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    if (!globalThis.supabase?.createClient) throw new Error('SDK unavailable');
    const authFetch = createAuthFetch({
      supabaseUrl: authConfig.supabaseUrl,
      report: event => console.info('[Sathivo Auth]', JSON.stringify(event)),
      onSendRateLimit: seconds => flow?.deferEmailRequests(seconds),
    });
    const client = globalThis.supabase.createClient(authConfig.supabaseUrl, authConfig.publishableKey, {
      global: { fetch: authFetch },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'sathivo.auth.v1' },
    });
    const recoveryClient = globalThis.supabase.createClient(authConfig.supabaseUrl, authConfig.publishableKey, {
      global: { fetch: authFetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sathivo.recovery.v1' },
    });
    flow = createAuthFlow({ auth: client.auth, recoveryAuth: recoveryClient.auth, enabled: true });
    notice.hidden = true;
    client.auth.onAuthStateChange(event => {
      // Keep callbacks synchronous; SDK auth calls inside this callback can deadlock.
      if (event === 'SIGNED_OUT' && activePanel === 'account' && !busy) {
        showPanel('login');
        clearSecrets();
        document.querySelector('#account-email').textContent = '';
        document.querySelector('#account-name').textContent = 'friend';
        announce('Your session has ended. Please sign in again.', 'info');
      }
    });
    setBusy(true);
    const user = await flow.currentUser();
    if (user && !['forgot', 'verify-email'].includes(initialRoute)) renderAccount(user);
  } catch {
    if (!flow) {
      notice.hidden = false;
      notice.textContent = 'Account services could not load. Please refresh the page or try again shortly.';
    } else announce('We could not restore your session. Please sign in again.', 'info');
  } finally { setBusy(false); }
}

const timer = setInterval(updateResend, 1000);
window.addEventListener('pagehide', () => {
  clearInterval(timer);
  clearSecrets();
  if (flow) void flow.cancelChallenge();
});
// A back/forward cache restore must not revive an old in-memory recovery grant.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
void initialize();
