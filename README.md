# Sathivo

Website and account integration for an India-wide, adults-only, strictly platonic companionship platform.

## Current release

- Responsive homepage with rose, plum, and soft cream styling.
- Supabase email/password authentication with email OTP verification and password recovery.
- Private member profile editor with photo upload and India location hierarchy.
- Explicit opt-in public companion listings with filters and public detail pages.
- Negotiated booking flow: companion sets an hourly rate; customer sends an experience/date/time request with an hourly offer; acceptance locks the offered rate as the agreed rate; customer can cancel; companion can mark accepted bookings completed.
- Participant-only booking chat with realtime updates.
- Account notifications for booking and message events.
- Blocking and safety reports with RLS-protected data.
- Completed-booking reviews and safe public rating aggregates.
- Moderation backend and admin page are implemented; the owner account is authorized in `platform_admins`. The admin overview shows total accounts, today's bookings, total bookings, profile gender counts, and live website presence.
- Sathivo records listed/offered/agreed rates for coordination but does not collect or process booking payments. Current monetization direction is advertising only. AdSense publisher ID is connected and the site is under AdSense review. Test ad placeholders remain enabled until Google marks the site Ready/Approved.
- Identity/age verification is not implemented; profiles remain clearly self-described.

## Files

```text
index.html                  Semantic homepage and section content
styles.css                  Design tokens, component styles, responsive layouts
script.js                   Menu, experience information, and accessible dialogs
account.html / account.css  Responsive account screens and privacy/boundaries
js/auth-config.js           Public project configuration and enrollment flag
js/auth-flow.js             Auth operations, validation, recovery state
js/account-page.js          Account screen behavior
assets/vendor/              Pinned Supabase browser SDK, integrity and license
supabase/templates/         Prepared signup and recovery OTP emails
tests/auth-flow.test.mjs    Auth boundary and SDK tests
docs/AUTH_SETUP.md          Activation instructions and pending live tests
ROADMAP.md                  Agreed product plan and development order
assets/companionship-india.jpg  AI-generated Indian cafe hero photograph
assets/companionship.jpg        Original stock photo retained as an unused asset
assets/icons.svg             Interface icon sprite
assets/favicon.svg           Brand favicon
THIRD_PARTY_NOTICES.md       Asset attribution and licensing
```

No package installation or build step is needed. Serve the repository root with any static HTTP server. External SVG sprites work reliably over HTTP; opening the page through a file:// URL may block them in some browsers. Google Fonts is optional at runtime; local serif and sans-serif fallbacks are included. All imagery and interface icons are local.

The owner enabled GitHub Pages from `main` at `/ (root)`: https://milanmiliyan5.github.io/sathivo-website/. All file paths work under that repository subpath. The custom domain `sathivo.co` is configured through GitHub Pages and Spaceship DNS. HTTPS certificate provisioning may remain pending until GitHub finishes DNS/certificate checks.

Run `npm test` for automated auth checks and `npm run check` for JavaScript syntax. These commands use Node and do not need dependency installation. `package-lock.json` records the pinned SDK dependency tree; the browser uses the verified local bundle rather than a CDN. No build step is required for GitHub Pages.

## Future development

Keep the homepage as the public entry point. When requested, add separate account, profile, and booking modules/routes backed by authenticated APIs; never put credentials, private data, age/identity documents, or payment secrets in frontend files. Keep display content separate from server-authoritative availability, prices, permissions, and booking state.

Recommended functional order: define the account/data model and service policies; implement server-enforced age requirements and authentication; companion applications and moderation; profiles and discovery; bookings and payments; reporting, blocking, and verification. Do not advertise these protections as active before they exist and are tested. Decide verification, payment, cancellation, privacy, and support arrangements before opening the marketplace.

## Brand and boundaries

Sathivo is strictly platonic, for adults 18+ only. No dating services, escort services, sexual services, sexual offers, or sexual activity. Conversation companionship is not therapy or crisis support. The intended direction is India-wide, with actual local availability dependent on companions joining. `sathivo.co` is the configured public domain for this release.

## Checks performed

JavaScript syntax, local assets, internal links, duplicate HTML IDs, and form/module references are checked. Eighteen automated tests verify the auth flow with a mock transport, including OTP type, recovery-only password changes, expired grants, resend/rate-limit handling, session checks, and the pinned browser SDK export/integrity. These tests do not send emails or create live accounts. Browser rendering and live auth delivery remain unverified; the required acceptance checks are listed in `docs/AUTH_SETUP.md`.


## Public legal & support pages — 2026-10-04

Sathivo now publishes Privacy Policy, Terms of Use, Safety & Community Guidelines, Support, and self-service Account Deletion pages. Support requests are submitted through a server-validated Edge Function and are visible only to authorized admins. Account deletion requires a signed-in user, password re-confirmation, matching email, and an explicit DELETE confirmation before server-side removal.


## Launch status — 2026-10-04

- Custom domain: `sathivo.co` configured.
- AdSense: publisher connected, ownership verified, review requested; test ads stay on until approval.
- Supabase plan: Free. Leaked-password protection is unavailable on this plan and can be enabled after upgrading to a plan that supports it.
- OTP frontend: exactly 6 digits. A fresh live signup should be used to confirm the hosted Auth email is also issuing 6-digit OTPs.
- Public legal/support/delete-account flows: implemented.
- Remaining launch gate: live two-account end-to-end testing across signup, profile, discovery, booking, chat/photos, push, completion, review, reporting, support and account deletion.


## Companion pricing and negotiation — 2026-10-05

- Companion/Both profiles can set a custom INR hourly companionship rate before publishing.
- Public listings show the companion's hourly rate.
- Customers can send a different hourly offer with a booking request.
- If the companion accepts, the customer offer is locked as the agreed hourly rate for that booking.
- Sathivo records the listed/offer/agreed rates only for coordination. It does not collect, hold, settle or refund booking payments.
- Users arrange any lawful cash/UPI/direct payment themselves outside Sathivo. UPI PINs, OTPs and banking credentials must never be shared.
