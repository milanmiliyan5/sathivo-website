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

drop policy if exists support_admin_read on public.support_requests;
create policy support_admin_read
on public.support_requests
for select
to authenticated
using (
  exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  )
);

drop policy if exists support_admin_update on public.support_requests;
create policy support_admin_update
on public.support_requests
for update
to authenticated
using (
  exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  )
);

create or replace function private.set_support_request_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists support_requests_set_updated_at on public.support_requests;
create trigger support_requests_set_updated_at
before update on public.support_requests
for each row execute function private.set_support_request_updated_at();

create index if not exists support_requests_status_created_idx
  on public.support_requests(status, created_at desc);
create index if not exists support_requests_email_created_idx
  on public.support_requests(lower(email), created_at desc);
