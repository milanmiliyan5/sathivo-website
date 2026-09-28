# Profiles rollout
Private customer/companion profile editor at profile.html. No public listings or bookings yet.
Uses existing auth storage key and vendored SDK; email is not duplicated into profile records.
RLS grants select/insert/update only to the row owner. Profile kind is a preference, not a permission or verified badge.
Photos: private bucket, owner-only paths, WebP conversion and 2 MB stored limit, five-minute signed URL.
Locations: 36 states/UTs, 42 selected city/town rows. This is a curated starter set, not a full district directory or service availability promise. City boundaries can span districts; selection represents the listed district only. Expand after reviewing district sources.
Sources consulted: https://www.india.gov.in/explore-india ; https://ganjam.odisha.gov.in/en/about-district/administrative-setup/subdivision-blocks ; https://bengaluruurban.nic.in/en/aboutdistrict/ ; https://imphalwest.nic.in/
Hosted schema applied as member_profiles_and_location_highlights; SQL snapshot in PROFILE_SETUP.sql is documentation, not an automatic rerunnable migration.
Validation: JS syntax; transactional owner insert/update and cross-user isolation (rolled back).
Still needs real signed-in browser photo upload/save/reload acceptance test.
Existing project advisor notices: rls_auto_enable SECURITY DEFINER execute grants; leaked password protection disabled. Not introduced by this change.
