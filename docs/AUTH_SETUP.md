# Sathivo account activation

## Existing-account signup guidance — 2026-09-26

The owner tried creating an account with an already verified address and waited on the OTP screen. The flow previously treated every non-session signup success as an email-verification challenge, including Supabase's sanitized response for an existing account.

Release `20260926-1` handles explicit signup errors `user_already_exists` / `email_exists` by offering password sign-in with a fixed “account already exists” message. A successful response with an explicitly empty `user.identities` array offers sign-in with conditional wording (“may already have an account”). Supabase also sanitizes identities for invited accounts, so the UI does not claim that this response proves registration, verification, or a signed-in session. The visible “Verify my email” path remains available. Missing identity fields are not treated as proof of a duplicate.

The sign-in form keeps the submitted email and clears all password/code fields. The signup password is never reused for an automatic login or to change an existing password. Choosing Forgot password or Verify my email carries the email forward. Signup and OTP screens also put existing-account guidance above the form so a neutral resend response does not leave the sign-in options below the fold. New unverified signup responses still follow the existing OTP verification flow.

No account-lookup endpoint, privileged key, database query, or hard-coded user address was added to the public application. Rate limits, confirmation settings, six/eight-digit support, recovery verification and the homepage remain unchanged. Regression checks include duplicate errors, sanitized success, missing identity fields and actual vendored-SDK response handling through a controlled transport. Live duplicate-signup acceptance still needs an owner-operated request; automated checks do not prove real email delivery.

## Six-digit rollout preparation — 2026-09-25

The owner requested six-digit email codes after completing verification. A read-only Auth check confirmed that the selected test account's email was verified at 14:00:01 UTC on 25 September, with a sign-in at the same time. This establishes successful real signup confirmation and an initial authenticated session. It does not establish logout/password login or successful password recovery.

Supabase generates the code length; frontend validation and the `{{ .Token }}` email template cannot change it. Its supported email OTP length is 6–10 digits. The owner must set **Authentication → Sign In / Providers → Email → Email OTP length** to **6** and save in the hosted project. The connected tools do not expose hosted Auth configuration updates, so this setting has not been changed or independently read here. Do not claim that six-digit emails are live until a newly delivered code confirms it.

Release `20260925-1` accepts exactly six or eight ASCII digits in both the shared HTML field and JavaScript validator. Six digits are the target; eight remain compatible with the currently delivered codes and emails already in flight. Supabase still verifies the complete token and its type. Codes are never truncated, converted to numbers, or accepted merely because their format matches. Four-, five-, seven- and nine-digit inputs are rejected. The field uses a six-digit placeholder and neutral instructions that match either delivered length. Prepared signup/recovery email templates retain `{{ .Token }}` and use length-neutral wording; these repository files are not automatically applied to the hosted templates.

The regression suite exercises six-digit signup and recovery, both lengths with leading zeroes through the actual SDK's controlled transport, invalid formats, provider rejection, cooldowns and recovery grants. Remaining live checks: save/confirm the hosted length setting, verify a freshly delivered six-digit signup code, then complete logout/password login and password recovery. Once six-digit delivery is evidenced and previously issued eight-digit codes have expired, the compatibility allowance can be removed in a follow-up.

## Eight-digit OTP correction — 2026-09-12

A fresh owner-selected signup returned HTTP 200, and a read-only Auth query confirmed a new, unverified user with a confirmation-send timestamp. The owner confirmed that the delivered email contained **eight digits**. The page still required six digits in its input pattern, minimum/maximum length and JavaScript validator. Browser validity inspection found a pattern mismatch, and no verification request was logged. The frontend format gate was therefore blocking verification before Supabase could check the code.

The shared signup/recovery field, validation, instructions and prepared email-template wording now use eight digits. Codes remain strings so leading zeroes are preserved. Invalid field format also produces a visible status message. Release queries are advanced together to `20260912-3` so returning browsers load the updated validator. No Auth methods, homepage layout, SMTP settings or provider OTP configuration were changed. Repository email templates still require independent application in Supabase; editing these files does not update the hosted templates.

The focused regression suite now includes the HTML input constraints alongside eight-digit verification through the actual vendored SDK's controlled transport, leading-zero preservation and rejection of six-, seven- and nine-digit inputs. Real signup and code receipt are evidenced as described above; successful real verification and subsequent password login are still being tested. Controlled tests do not prove inbox delivery or production acceptance.

## Signup resend investigation — 2026-09-12

The owner received the first confirmation email in Gmail, then reported that signup/resend no longer delivered a code after changing the hosted signup template to `{{ .Token }}`. A fresh read-only Auth query found that the test account's email was **already confirmed at 07:10:53 UTC (12:40:53 IST)**, with a sign-in at the same time. Its last signup confirmation send remained 07:02:06 UTC; no recovery email had been requested when this investigation started. This establishes the verified state, not who clicked a link or which browser performed confirmation.

Supabase's [resend implementation](https://github.com/supabase/auth/blob/master/internal/api/resend.go) intentionally returns HTTP 200 with an empty object for an already-confirmed email and sends nothing. It also returns a neutral response for an unknown address. Neither a successful resend response nor the SDK's empty result proves inbox delivery. Do not introduce an unauthenticated account-lookup endpoint or infer account existence from that response.

The existing calls were correct: password signup through `signUp`, signup resend through `resend({ type: 'signup', email })`, signup OTP verification with `type: 'email'`, and recovery through `resetPasswordForEmail` / `verifyOtp({ type: 'recovery' })`. They have been preserved.

Targeted changes:

- The signup OTP page explains that verification is needed only once and provides visible password sign-in and reset links. The pending email carries over when the user chooses a link. Request feedback no longer implies that a completed request proves an email was sent.
- Server-rejected email requests also start a cooldown, including failures on the first request. Honor a readable `Retry-After` interval; otherwise use a 60-second local wait. Show the wait on signup, verification and recovery forms. Provider limits remain authoritative and may last longer.
- `js/auth-transport.js` adds local console diagnostics containing only fixed operation names and HTTP status numbers. It does not read/log bodies, email addresses, passwords, codes, headers, tokens or complete URLs. The only header used internally is `Retry-After`. No diagnostics are uploaded to a telemetry service.
- Provider email/service failures remain errors and cannot transition into a successful email challenge. Release queries for the account entry script and its module imports are `20260912-2`.

The browser console inspected before the fix showed extension metadata errors, not a Sathivo application exception. The available Supabase connector does not expose hosted Auth service logs; the Auth database audit query returned no events. Do not interpret missing audit entries as proof that requests were absent. The new browser diagnostics can establish the endpoint and HTTP outcome during real testing without exposing credentials.

All 23 automated regression checks pass. They exercise the actual vendored SDK with a controlled HTTP transport, including the empty resend response, correct endpoint/payload types, wrong-code rejection, rate-limit delays, and diagnostic redaction. They do **not** prove real inbox delivery. The existing account should next be tested using email/password sign-in. A separate owner-selected unused email is required for a fresh signup test. Real OTP arrival, OTP verification, expiration, password recovery and new/old-password acceptance remain pending until evidenced; the account release is not yet fully accepted.

## Live acceptance testing — 2026-09-12

The owner reports that Resend verified `auth.sathivo.co` and Custom SMTP is enabled in Supabase with `no-reply@auth.sathivo.co`. The existing account integration is being activated for the requested real-account tests; it has not been rewritten. `accountsEnabled` is now true.

GitHub and the live browser still showed the preview switch off at the start of this task. A fresh Supabase query found zero accounts and zero confirmed emails before testing.

The local public Auth settings request timed out. SMTP settings are owner-confirmed, not independently read through this connector. Custom SMTP being enabled does not establish the delivered code length or template content. The later eight-digit investigation above records the owner's actual signup email observation; the hosted recovery template still requires an independent live check.

At activation, live inbox delivery, signup confirmation, logout/login, wrong and expired OTPs, password reset, old-password rejection, and the created Supabase user were pending. The investigation record above contains subsequent evidence. Passwords and OTPs must be entered in the secure browser, not shared in chat or committed.

Activation exposed a stale-module issue in the live browser: the new HTML rendered, but forms remained disabled and the SDK script was never requested while GitHub's configuration was already enabled. The account entry script and its configuration import were versioned together (`20260912-1` at activation) so a returning browser requests the new configuration. When changing account modules, advance the entry script and import release queries together. Confirm enabled forms in the live browser after deployment; a successful build alone is insufficient.

## Initial implementation record — 2026-09-08

The connected Supabase project is **Sathivo**, reference `ujutlzjsgbqtlisecpnh`, region `ap-south-1`. The connector reports `ACTIVE_HEALTHY`. A read-only SQL check found zero existing Auth accounts; the `public` schema has no application tables. No account or database data was modified during this release.

The account UI and Supabase integration are implemented, but **public enrollment was initially closed** through `accountsEnabled: false` in `js/auth-config.js`. The forms were disabled in the initial release. This is not yet a completed live-auth release. No signup, OTP delivery, password reset, or mobile browser session has been tested against the live provider yet.

The available Supabase connector can inspect projects and databases but does not expose Auth configuration, SMTP secrets, or email template updates. Sender settings have not been verified. The public Auth settings HTTP request could not complete because network approval was cancelled. Do not assume default settings or change existing settings without reading them first.

## Implemented behavior

- Email and password signup, with name, adult self-declaration and platonic-boundaries acceptance.
- Signup email confirmation using a typed email code and `verifyOtp` with `type: 'email'`; six digits are the target, with eight-digit compatibility during the provider transition above.
- Email/password login, server-validated session restoration, and sign-out on this device.
- Recovery uses `resetPasswordForEmail`, then `verifyOtp` with `type: 'recovery'`, then `updateUser({ password })`. It never substitutes passwordless login for password recovery.
- Recovery uses a separate in-memory SDK client. Tokens are not copied into application state, URLs, or persisted recovery storage. Leaving/reloading the page requires a fresh recovery flow.
- A verified recovery grant is consumed after a successful change and expires in this UI after ten minutes. Supabase enforces the actual token validity.
- The page requests global sign-out after password changes and discards its local sessions. If revocation fails, the page reports that the password changed but sign-out was incomplete. Already-issued access tokens can remain valid until their configured expiry; do not advertise instant session revocation.
- The SDK stores normal sign-in session tokens in browser storage under `sathivo.auth.v1`. Recovery uses a distinct, nonpersistent storage key.
- Six- or eight-digit format validation, password confirmation, safe errors, duplicate-submit prevention, a 60-second resend cooldown and handling of provider rate-limit errors.

The browser cooldown, declared age and feature flag are **not server access controls**. User metadata is editable and is used only for a display name and self-declaration. It grants no customer/companion/admin privileges and does not prove age or identity. No application table or role permission is exposed in this stage.

## Configuration to complete before activation

Use an authorized project configuration connection or the Supabase Dashboard. Review existing settings first. Never place a service-role key, SMTP password or management token in this repository or in chat.

1. Check the current email provider, email confirmation setting, URL configuration, OTP settings, signup restrictions and rate limits.
2. Connect an owner-controlled email sender with a verified sending domain and a suitable SMTP provider. Do not create a paid subscription or buy a domain without the owner's authorization. The built-in sender is limited to testing and cannot be assumed to deliver to public customers.
3. Enable email/password authentication and require email confirmation. Keep anonymous sign-in disabled. Set the password minimum to at least 12 characters. The frontend's password rule alone cannot enforce this against direct API requests.
4. Set hosted **Email OTP length** to **6** for the owner's requested rollout, and confirm fresh signup/recovery email delivery. The frontend supports both six and existing eight digits during the transition. Review the actual expiry (proposed: 10 minutes) and server-enforced sending/verification rate limits. Set up abuse protection appropriate for public enrollment. If CAPTCHA is enabled, implement and test its token handoff before opening forms.
5. Apply `supabase/templates/confirmation.html` to **Confirm signup**, and `supabase/templates/recovery.html` to **Reset password**. Both use `{{ .Token }}` rather than a confirmation link. Suggested subjects: “Verify your Sathivo email” and “Reset your Sathivo password”. These files are prepared templates, not proof they have been applied.
6. Set the Site URL to `https://milanmiliyan5.github.io/sathivo-website/` and allow the account page `https://milanmiliyan5.github.io/sathivo-website/account.html` as needed. Do not leave localhost as the production fallback or add broad redirect wildcards. The implemented flow uses typed codes and does not consume tokens from redirect URLs.
7. Publish the actual account privacy policy, support contact, and account deletion process. Define how the 18+ requirement will be enforced before opening marketplace participation; email verification and a checkbox are not age verification.
8. Complete the owner-authorized real-account testing on the activated account page. The homepage remains anonymous. Treat the account release as under test until each acceptance check below is evidenced; update this record with actual outcomes. Activation alone is not proof of production readiness.

Since 3 June 2026, new free-tier projects on Supabase's default email provider cannot customize Auth email templates. A custom SMTP provider permits customization. This project was created after that date; check its plan and sender rather than assuming template edits are available.

## Live acceptance checks still pending

- Signup sends a verification **code** to the intended test inbox; no unverified account can sign in.
- Code verification opens the expected account; no role/age-verification badge is implied.
- Login/logout and reload work with the server session; sign-out is reflected across open tabs.
- Forgot-password produces neutral messaging for both an existing and an unknown address, without creating an account for the unknown address.
- Incorrect, expired and reused OTPs fail; resend uses the latest code and rate limits remain enforced after reload/direct requests.
- A correct recovery code allows a password change; new password succeeds and old password fails.
- Password update and sign-out failures are accurately reported; recovery cannot resume from URL tampering or a back/forward cache snapshot.
- Verify keyboard navigation, screen-reader status messages and mobile layouts on an actual browser.

The initial implementation sent no test email or signup request; subsequent real-test evidence is recorded above. Automated tests use a controlled Auth transport and test the actual vendored SDK without sending live requests.

## References

- [Password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Email templates and the Token variable](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Email template change for new Free projects](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)
- [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp)
- [Supported email OTP length](https://supabase.com/docs/guides/local-development/cli/config#auth.email.otp_length)
- [Password reset](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)

## Next application-data stage

Add only the data model required by the next accepted feature. Exposed tables must have deliberate grants and RLS policies tied to the authenticated user, with server-controlled permissions for administrative actions. Keep private emails and birth/identity information out of public companion profiles. Do not use the browser rollout flag or user-editable metadata as authorization.
