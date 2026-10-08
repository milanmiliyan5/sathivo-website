# Profiles rollout

Private customer/companion profile editor at `profile.html`, with opt-in public companion publishing.

Uses the shared Supabase auth client; email is not duplicated into public listing records. RLS keeps private profile rows owner-only while published companion snapshots are publicly readable.

Photos: private owner profile bucket, separate published-listing snapshot bucket, WebP compression, and short-lived signed URLs.

Locations: all 36 States/UTs and district-wide fallback rows are stored in `profile_locations`. The original catalog also contains curated named city/town suggestions. As of 2026-10-08, profiles additionally store an exact `city_name`: users may type any Indian city or town even when it is not pre-seeded. The same exact city/town value is copied to the public companion listing and can be searched on Explore. Canonical and already-published city names appear as autocomplete suggestions, so missing fixed-list entries no longer block profile creation or discovery.

The district catalog was expanded from an official-government-derived India district snapshot. Exact city/town entry is intentionally future-proof because municipal boundaries and names change more often than the district catalog.

Hosted schema migrations are tracked under `supabase/migrations/`; the current location enhancement is `20261008180738_exact_city_town_profile_discovery.sql`.

Validation: project integrity tests, static asset/version checks, and live database migration verification. Full two-account browser acceptance testing remains a launch gate.
