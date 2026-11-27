-- Members may acknowledge their own notifications; only trusted server code creates their content.
revoke update on table public.notifications from authenticated;
grant update (read_at, plans_seen_at) on table public.notifications to authenticated;
