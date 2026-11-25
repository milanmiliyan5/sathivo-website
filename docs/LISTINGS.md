# Opt-in companion discovery
Hosted migration: opt_in_companion_listings (applied 2026-09-28).
Frontend release: 2026-10-02.
Routes: companions.html (filters, pagination); companion.html?id=<public_id> (detail).
The profile editor uses listing-publish.js to save private details and apply the explicit Public Profile and Show Gender switch choices in one Save Changes action. New/private profiles stay private unless Public Profile is enabled by the owner. No separate publishing popup.
Fields: display name, photo, bio, location, languages, interests, categories, meeting preference, availability. No email, password, verification badge or rating.
Tables: member_profiles stays owner-only; companion_listings readable when published, owner-writable; profile_locations public read-only.
Storage: listing-photos is private, owner writes only, public signed reads only for published rows. Profile-photos remains owner-only. Signed URLs can remain valid briefly after hiding.
Replacing a public photo first hides the listing. Failure keeps it hidden; retry Save Changes. Ordinary edits reuse the unchanged photo and do not hide the card.
Tests: transactional owner draft/read, anonymous visibility, publish/hide, cross-user update denial pass, rolled back. User's real listing was not published for testing.
Existing advisor notices remain: rls_auto_enable execute permissions and leaked-password protection. See https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
Booking, payments, reviews, identity verification and moderation workflow are not included in this release.
