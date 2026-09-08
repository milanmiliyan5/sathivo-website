# Sathivo

First homepage release for an India-wide, adults-only, strictly platonic companionship platform.

## Current release

- Responsive homepage with rose, plum, and soft cream styling.
- Hero, experiences, how it works, why Sathivo, safety, companion section, FAQ, and footer.
- Nine experience detail dialogs, working mobile navigation, community guidance, and a website privacy notice.
- Keyboard-accessible native dialogs and FAQ disclosure controls, visible focus, skip navigation, and reduced-motion support.
- No fictional profiles, testimonials, verification badges, or booking counts.

This is a working informational homepage, **not a live marketplace**. Accounts, companion applications, profiles, booking, payments, verification, and reporting are not implemented. Every relevant call to action explains this instead of claiming to create a booking or collect a registration. Companions' own rates and platform fees are not collected or processed here.

## Files

```text
index.html                  Semantic homepage and section content
styles.css                  Design tokens, component styles, responsive layouts
script.js                   Menu, experience information, and accessible dialogs
assets/companionship-india.jpg  AI-generated Indian cafe hero photograph
assets/companionship.jpg        Original stock photo retained as an unused asset
assets/icons.svg             Interface icon sprite
assets/favicon.svg           Brand favicon
THIRD_PARTY_NOTICES.md       Asset attribution and licensing
```

No package installation or build step is needed. Serve the repository root with any static HTTP server. External SVG sprites work reliably over HTTP; opening the page through a file:// URL may block them in some browsers. Google Fonts is optional at runtime; local serif and sans-serif fallbacks are included. All imagery and interface icons are local.

The repository contains source only. No GitHub Pages, domain, or other public website hosting is configured by this release. Repository visibility and website hosting are separate settings.

## Future development

Keep the homepage as the public entry point. When requested, add separate account, profile, and booking modules/routes backed by authenticated APIs; never put credentials, private data, age/identity documents, or payment secrets in frontend files. Keep display content separate from server-authoritative availability, prices, permissions, and booking state.

Recommended functional order: define the account/data model and service policies; implement server-enforced age requirements and authentication; companion applications and moderation; profiles and discovery; bookings and payments; reporting, blocking, and verification. Do not advertise these protections as active before they exist and are tested. Decide verification, payment, cancellation, privacy, and support arrangements before opening the marketplace.

## Brand and boundaries

Sathivo is strictly platonic, for adults 18+ only. No dating services, escort services, sexual services, sexual offers, or sexual activity. Conversation companionship is not therapy or crisis support. The intended direction is India-wide, with actual local availability dependent on companions joining. `sathivo.co` is a future domain direction, not a configured URL in this release.

## Checks performed

JavaScript syntax, local asset existence, internal fragment links, duplicate HTML IDs, SVG symbol references, and experience/button mapping were checked. Browser rendering and live booking flows were not tested; booking flows do not exist in this version.
