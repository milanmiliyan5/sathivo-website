# Sathivo

Website and account integration for an India-wide, adults-only, strictly platonic companionship platform.

## Current release

- Responsive homepage with rose, plum, and soft cream styling.
- Supabase email/password authentication with email OTP verification and password recovery.
- Private member profile editor with photo upload and India location hierarchy.
- Explicit opt-in public companion listings with filters and public detail pages.
- Free booking-request flow: customer sends an experience/date/time request; companion can accept or decline; customer can cancel; companion can mark accepted bookings completed.
- Participant-only booking chat with realtime updates.
- Account notifications for booking and message events.
- Blocking and safety reports with RLS-protected data.
- Completed-booking reviews and safe public rating aggregates.
- Moderation backend and admin page are implemented; an owner/moderator account still needs to be explicitly authorized in `platform_admins`.
- Sathivo does not process payments. Current monetization direction is advertising only. Ad placements/config are prepared but disabled until a real approved publisher ID is connected.
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

The owner enabled GitHub Pages from `main` at `/ (root)`: https://milanmiliyan5.github.io/sathivo-website/. All file paths work under that repository subpath. No custom domain is configured.

Run `npm test` for automated auth checks and `npm run check` for JavaScript syntax. These commands use Node and do not need dependency installation. `package-lock.json` records the pinned SDK dependency tree; the browser uses the verified local bundle rather than a CDN. No build step is required for GitHub Pages.

## Future development

Keep the homepage as the public entry point. When requested, add separate account, profile, and booking modules/routes backed by authenticated APIs; never put credentials, private data, age/identity documents, or payment secrets in frontend files. Keep display content separate from server-authoritative availability, prices, permissions, and booking state.

Recommended functional order: define the account/data model and service policies; implement server-enforced age requirements and authentication; companion applications and moderation; profiles and discovery; bookings and payments; reporting, blocking, and verification. Do not advertise these protections as active before they exist and are tested. Decide verification, payment, cancellation, privacy, and support arrangements before opening the marketplace.

## Brand and boundaries

Sathivo is strictly platonic, for adults 18+ only. No dating services, escort services, sexual services, sexual offers, or sexual activity. Conversation companionship is not therapy or crisis support. The intended direction is India-wide, with actual local availability dependent on companions joining. `sathivo.co` is a future domain direction, not a configured URL in this release.

## Checks performed

JavaScript syntax, local assets, internal links, duplicate HTML IDs, and form/module references are checked. Eighteen automated tests verify the auth flow with a mock transport, including OTP type, recovery-only password changes, expired grants, resend/rate-limit handling, session checks, and the pinned browser SDK export/integrity. These tests do not send emails or create live accounts. Browser rendering and live auth delivery remain unverified; the required acceptance checks are listed in `docs/AUTH_SETUP.md`.
