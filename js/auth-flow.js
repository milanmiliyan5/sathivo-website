// Auth calls live here so UI code never handles tokens or implements passwords.
export class AuthFlowError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}

const fail = (code, message) => { throw new AuthFlowError(code, message); };

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('email', 'Enter a valid email address.');
  }
  return email;
}

export function validatePassword(value, confirmation = value) {
  const password = String(value ?? '');
  if ([...password].length < 12 || password.length > 128) {
    fail('password', 'Use a password with 12–128 characters. A few unrelated words work well.');
  }
  if (password !== confirmation) fail('password_match', 'Your passwords do not match.');
  return password;
}

function normalizeOtp(value) {
  const token = String(value ?? '').trim();
  // Support six-digit rollout and existing eight-digit emails. Supabase verifies
  // the complete token; never shorten a code to match the preferred length.
  if (!/^\d{6}(?:\d{2})?$/.test(token)) fail('otp', 'Enter the 6- or 8-digit code from your email.');
  return token;
}

function providerError(error, context) {
  if (error instanceof AuthFlowError) return error;
  if (error?.status === 429 || /rate_limit|over_email_send_rate_limit|over_request_rate_limit/.test(error?.code ?? '')) {
    return new AuthFlowError('rate_limit', 'Requests are temporarily limited. Please wait before trying again; the email provider may require a longer wait.');
  }
  if (error?.code === 'email_address_invalid') return new AuthFlowError('email', 'Use a real email address that can receive messages.');
  if (error?.code === 'email_address_not_authorized') return new AuthFlowError('email_delivery', 'Email delivery is not available for this address right now. Please try again later.');
  if (context === 'signup' && ['user_already_exists', 'email_exists'].includes(error?.code)) {
    return new AuthFlowError('already_registered', 'An account with this email already exists. Sign in with your existing password, or choose “Forgot password?” below.');
  }
  if (['signup', 'send'].includes(context) && error?.status >= 500) {
    return new AuthFlowError('email_delivery', 'The email request could not be completed. Please try again later.');
  }
  if (context === 'verify' && (error?.status === 400 || error?.status === 403 || error?.code === 'otp_expired')) {
    return new AuthFlowError('invalid_code', 'That code is invalid or has expired. Check the code or request a new one.');
  }
  if (context === 'login' && error?.code === 'email_not_confirmed') {
    return new AuthFlowError('email_not_confirmed', 'Verify your email before signing in. Choose “Verify my email” below.');
  }
  if (context === 'login' && error?.code === 'invalid_credentials') {
    return new AuthFlowError('invalid_credentials', 'The email or password is incorrect. Please try again.');
  }
  if (error?.code === 'same_password') return new AuthFlowError('same_password', 'Choose a password different from your current password.');
  if (error?.code === 'weak_password') return new AuthFlowError('weak_password', 'Choose a stronger password that you do not use elsewhere.');
  return new AuthFlowError('unavailable', 'We could not complete that request. Check your connection and try again shortly.');
}

async function call(operation, context) {
  try {
    const result = await operation();
    if (result.error) throw result.error;
    return result.data;
  } catch (error) {
    throw providerError(error, context);
  }
}

export function createAuthFlow({ auth, recoveryAuth, enabled, clock = Date.now }) {
  let challenge = null;
  let resendAt = 0;
  let recoveryUntil = 0;
  const requireEnabled = () => {
    if (!enabled) fail('not_open', 'Accounts are coming soon. Email verification is still being prepared.');
  };
  const requireChallenge = () => {
    requireEnabled();
    if (!challenge) fail('no_challenge', 'Request a fresh email code to continue.');
    return challenge;
  };
  const requireSendWindow = () => {
    const remaining = Math.max(0, Math.ceil((resendAt - clock()) / 1000));
    if (remaining) fail('resend_wait', `Please wait ${remaining} seconds before requesting another code.`);
  };
  const deferEmailRequests = (seconds = 60) => {
    if (Number.isFinite(seconds) && seconds > 0) resendAt = Math.max(resendAt, clock() + Math.ceil(seconds) * 1000);
  };
  const send = async (operation, context = 'send') => {
    try { return await call(operation, context); }
    catch (error) {
      // A rejected request must also start a cooldown. Keep any longer Retry-After.
      if (error.code === 'rate_limit') deferEmailRequests();
      throw error;
    }
  };
  const startChallenge = (kind, email) => {
    challenge = { kind, email };
    recoveryUntil = 0;
    resendAt = clock() + 60_000;
    return { ...challenge };
  };
  const signInAfterSignup = (email, message) => {
    challenge = null;
    recoveryUntil = 0;
    return { kind: 'sign-in', email, message };
  };

  return {
    getChallenge: () => challenge && { ...challenge },
    resendSeconds: () => Math.max(0, Math.ceil((resendAt - clock()) / 1000)),
    deferEmailRequests,
    async signup({ name, email, password, confirmation, adult, boundaries }) {
      requireEnabled();
      requireSendWindow();
      const displayName = String(name ?? '').trim();
      if (displayName.length < 2 || displayName.length > 60) fail('name', 'Enter your name using 2–60 characters.');
      if (adult !== true) fail('adult', 'Sathivo is for adults aged 18 or older.');
      if (boundaries !== true) fail('boundaries', 'Please agree to the platonic-only community boundaries.');
      const address = normalizeEmail(email);
      let data;
      try { data = await send(() => auth.signUp({
        email: address,
        password: validatePassword(password, confirmation),
        options: { data: {
          display_name: displayName,
          // A self-declaration, never an age/identity verification or permission.
          adult_declaration: true,
          community_rules_version: '2026-09-08',
        } },
      }), 'signup'); }
      catch (error) {
        if (error.code === 'already_registered') return signInAfterSignup(address, error.message);
        throw error;
      }
      // This flow requires server-side email confirmation. Fail closed if disabled.
      if (data?.session) {
        await auth.signOut({ scope: 'local' });
        fail('confirmation_required', 'Email verification is not ready yet. Please try again later.');
      }
      // Supabase can return a sanitized user with no identities for an existing
      // account (also for an invite). This is guidance, never proof of sign-in.
      if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
        deferEmailRequests();
        return signInAfterSignup(address, 'This email may already have an account. Sign in with your existing password, or choose “Forgot password?” below. If you still need to verify your email, choose “Verify my email”.');
      }
      return startChallenge('signup', address);
    },
    async login({ email, password }) {
      requireEnabled();
      if (!password || password.length > 128) fail('password', 'Enter your password.');
      await call(() => auth.signInWithPassword({ email: normalizeEmail(email), password }), 'login');
      const data = await call(() => auth.getUser(), 'session');
      if (!data?.user?.email_confirmed_at) {
        await auth.signOut({ scope: 'local' });
        fail('email_not_confirmed', 'Verify your email before signing in.');
      }
      challenge = null;
      return data.user;
    },
    async currentUser() {
      requireEnabled();
      const sessionData = await call(() => auth.getSession(), 'session');
      if (!sessionData?.session) return null;
      // Storage only locates the session; the Auth server verifies the user.
      const data = await call(() => auth.getUser(), 'session');
      return data?.user?.email_confirmed_at ? data.user : null;
    },
    async requestRecovery(email) {
      requireEnabled();
      requireSendWindow();
      const address = normalizeEmail(email);
      // A password-recovery challenge, never signInWithOtp / account creation.
      await send(() => recoveryAuth.resetPasswordForEmail(address));
      return startChallenge('recovery', address);
    },
    async requestSignupCode(email) {
      requireEnabled();
      requireSendWindow();
      const address = normalizeEmail(email);
      await send(() => auth.resend({ type: 'signup', email: address }));
      return startChallenge('signup', address);
    },
    async resend() {
      const pending = requireChallenge();
      requireSendWindow();
      if (pending.kind === 'recovery') {
        await send(() => recoveryAuth.resetPasswordForEmail(pending.email));
      } else {
        await send(() => auth.resend({ type: 'signup', email: pending.email }));
      }
      recoveryUntil = 0;
      resendAt = clock() + 60_000;
    },
    async verify(value) {
      const pending = requireChallenge();
      const isRecovery = pending.kind === 'recovery';
      const client = isRecovery ? recoveryAuth : auth;
      const data = await call(() => client.verifyOtp({
        email: pending.email,
        token: normalizeOtp(value),
        type: isRecovery ? 'recovery' : 'email',
      }), 'verify');
      if (!data?.session || !data?.user?.email_confirmed_at) fail('invalid_code', 'Request a fresh email code to continue.');
      if (isRecovery) {
        recoveryUntil = clock() + 10 * 60_000;
        return { kind: 'recovery' };
      }
      challenge = null;
      return { kind: 'signup', user: data.user };
    },
    async changePassword(password, confirmation) {
      requireEnabled();
      if (challenge?.kind !== 'recovery' || !recoveryUntil || clock() >= recoveryUntil) {
        recoveryUntil = 0;
        fail('recovery_expired', 'For your security, request a new reset code before changing your password.');
      }
      await call(() => recoveryAuth.updateUser({ password: validatePassword(password, confirmation) }), 'password');
      // Do not allow this UI grant to change the password a second time.
      recoveryUntil = 0;
      challenge = null;
      let sessionsRevoked = true;
      try {
        const result = await recoveryAuth.signOut({ scope: 'global' });
        sessionsRevoked = !result.error;
      } catch { sessionsRevoked = false; }
      // Discard the in-memory recovery session even if global revocation failed.
      try { await recoveryAuth.signOut({ scope: 'local' }); } catch { /* already discarded on unload */ }
      try {
        const result = await auth.signOut({ scope: 'local' });
        if (result.error) sessionsRevoked = false;
      } catch { sessionsRevoked = false; }
      return { sessionsRevoked };
    },
    async cancelChallenge() {
      challenge = null;
      recoveryUntil = 0;
      try { await recoveryAuth.signOut({ scope: 'local' }); } catch { /* memory only */ }
    },
    async logout() {
      requireEnabled();
      await call(() => auth.signOut({ scope: 'local' }), 'logout');
      challenge = null;
    },
  };
}
