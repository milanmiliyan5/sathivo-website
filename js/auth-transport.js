// Local diagnostics contain only fixed operation names and numeric HTTP statuses.
// Never log request/response bodies, URLs, headers or credential values.
const operations = new Map([
  ['/auth/v1/signup', 'signup'], ['/auth/v1/resend', 'resend_signup'],
  ['/auth/v1/recover', 'request_recovery'], ['/auth/v1/verify', 'verify_code'],
  ['/auth/v1/token', 'sign_in_or_refresh'], ['/auth/v1/user', 'account'],
  ['/auth/v1/logout', 'sign_out'],
]);
const emailOperations = new Set(['signup', 'resend_signup', 'request_recovery']);

export function createAuthFetch({ supabaseUrl, fetchImpl = fetch, report = () => {}, onSendRateLimit = () => {}, clock = Date.now }) {
  const origin = new URL(supabaseUrl).origin;
  const notify = (callback, value) => { try { callback(value); } catch { /* Diagnostics must never affect Auth. */ } };
  return async (input, init) => {
    let operation;
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      if (url.origin === origin) operation = operations.get(url.pathname);
    } catch { /* Pass invalid input to the native fetch implementation. */ }
    let response;
    try { response = await fetchImpl(input, init); }
    catch (error) {
      if (operation) notify(report, { operation, status: 0 });
      throw error;
    }
    if (operation) notify(report, { operation, status: response.status });
    if (response.status === 429 && emailOperations.has(operation)) {
      // Read only the retry interval; preserve the entire response for the SDK.
      const retry = response.headers.get('Retry-After');
      const seconds = retry && /^\d+$/.test(retry.trim()) ? Number(retry)
        : retry ? Math.ceil((Date.parse(retry) - clock()) / 1000) : NaN;
      notify(onSendRateLimit, Number.isFinite(seconds) && seconds > 0 ? seconds : 60);
    }
    return response;
  };
}
