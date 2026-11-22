-- Fix Supabase PostgREST 42501 when send-nearby-email reads a newly
-- published companion's announcement.
-- This Edge Function uses its backend-only service_role key, never a
-- browser/client key. Grants are scoped to the existing function's queries.
-- RLS policies and privileges for anon/authenticated roles are unchanged.

GRANT SELECT ON TABLE public.nearby_listing_announcements TO service_role;
GRANT SELECT, UPDATE ON TABLE public.nearby_email_queue TO service_role;
GRANT SELECT ON TABLE public.nearby_alert_preferences TO service_role;
GRANT SELECT ON TABLE public.member_profiles TO service_role;
GRANT SELECT ON TABLE public.user_blocks TO service_role;
GRANT SELECT ON TABLE public.profile_locations TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.nearby_email_daily_limit TO service_role;
