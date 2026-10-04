-- Sathivo structured feedback
-- Applied to the live project on 2026-10-05.
alter table public.support_requests add column if not exists rating smallint;
alter table public.support_requests add column if not exists feedback_type text;

-- Live DB constraints:
-- rating is NULL or 1..5
-- feedback_type is NULL or one of suggestion, bug, experience, compliment, other
-- Feedback rows continue using the existing support_requests admin-only RLS model.
-- Public submission goes through the server-validated submit-support Edge Function.
