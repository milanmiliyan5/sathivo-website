-- Sathivo aggregate visitor analytics
-- Applied to the live Supabase project on 2026-10-05.
-- Counts unique browser identifiers; raw browser UUIDs are hashed by the
-- track-site-visit Edge Function before database storage.

create table if not exists public.site_visitors(
  visitor_hash text primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_page text
);

create table if not exists public.site_daily_visitors(
  visit_date date not null,
  visitor_hash text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_page text,
  primary key(visit_date, visitor_hash)
);

alter table public.site_visitors enable row level security;
alter table public.site_daily_visitors enable row level security;

revoke all on table public.site_visitors from public, anon, authenticated;
revoke all on table public.site_daily_visitors from public, anon, authenticated;
grant select, insert, update on table public.site_visitors to service_role;
grant select, insert, update on table public.site_daily_visitors to service_role;

create policy site_visitors_deny_clients on public.site_visitors
for all to anon, authenticated using (false) with check (false);
create policy site_daily_visitors_deny_clients on public.site_daily_visitors
for all to anon, authenticated using (false) with check (false);

-- Admin dashboard statistics are returned only through the admin-authorized
-- admin-dashboard-stats Edge Function.
