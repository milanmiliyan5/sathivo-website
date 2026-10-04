-- Applied to the live Sathivo Supabase project on 2026-10-04.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  email text not null,
  category text not null check (category in ('account','privacy','safety','technical','feedback','other')),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 3000),
  status text not null default 'open' check (status in ('open','reviewed','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_requests enable row level security;
revoke all on table public.support_requests from anon;
revoke all on table public.support_requests from authenticated;
grant select, update on table public.support_requests to authenticated;
create policy support_admin_read on public.support_requests for select to authenticated
using (exists(select 1 from public.platform_admins pa where pa.user_id=(select auth.uid())));
create policy support_admin_update on public.support_requests for update to authenticated
using (exists(select 1 from public.platform_admins pa where pa.user_id=(select auth.uid())))
with check (exists(select 1 from public.platform_admins pa where pa.user_id=(select auth.uid())));
