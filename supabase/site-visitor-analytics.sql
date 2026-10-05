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

-- Live DB revokes public/anon/authenticated access and grants only the
-- service_role access needed by the server-side tracking/stat functions.
-- Admin dashboard statistics are returned through the admin-only
-- admin-dashboard-stats Edge Function.
