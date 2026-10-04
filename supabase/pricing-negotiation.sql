-- Sathivo companion pricing + customer offer negotiation
-- Applied to the live project on 2026-10-05.
-- Rates are coordination data only. Sathivo does not process booking payments.

alter table public.member_profiles add column if not exists hourly_rate integer;
alter table public.companion_listings add column if not exists hourly_rate integer;
alter table public.booking_requests add column if not exists listed_hourly_rate integer;
alter table public.booking_requests add column if not exists offered_hourly_rate integer;
alter table public.booking_requests add column if not exists agreed_hourly_rate integer;

-- Live database additionally contains:
-- - CHECK constraints limiting rate fields to ₹1..₹1,00,000 per hour when present.
-- - private.enforce_companion_listing_rate() to block publishing without a valid rate.
-- - public.create_booking_request_with_offer(...) SECURITY INVOKER RPC.
-- - a compatibility public.create_booking_request(...) RPC that uses the listed rate.
-- - private.enforce_booking_transition() which makes listed/offer values immutable
--   after submission and automatically sets agreed_hourly_rate to the customer's
--   offer when the companion accepts.
-- - hardened booking INSERT RLS that verifies the listed rate against the active
--   public companion listing.
-- - booking notifications that mention the offer/agreed hourly rate.
--
-- Existing published listings that had no rate before this feature were hidden
-- rather than assigning an invented monetary amount. Owners must save a rate and
-- republish them.
