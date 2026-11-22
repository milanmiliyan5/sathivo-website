-- Sathivo manual Active Member recognition; not identity verification.
-- Badge grants are administered separately; no individual user IDs are committed.
create table if not exists public.active_member_badges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  awarded_at timestamptz not null default now()
);
alter table public.active_member_badges enable row level security;
revoke all on table public.active_member_badges from public, anon, authenticated;
grant select on table public.active_member_badges to anon, authenticated;
drop policy if exists active_member_badges_public_read on public.active_member_badges;
create policy active_member_badges_public_read on public.active_member_badges
  for select to anon, authenticated using (true);

create or replace function public.public_active_member_badges(p_public_ids uuid[])
returns table(public_id uuid)
language sql stable security invoker
set search_path = public, pg_temp
as $fn$
  select distinct l.public_id
  from public.companion_listings l
  join public.active_member_badges a on a.user_id=l.user_id
  where l.public_id = any(p_public_ids)
    and l.published and l.moderation_status='active'
    and cardinality(p_public_ids) between 1 and 100;
$fn$;
revoke all on function public.public_active_member_badges(uuid[]) from public, anon, authenticated;
grant execute on function public.public_active_member_badges(uuid[]) to anon, authenticated;
comment on table public.active_member_badges is 'Manual Active Member community activity acknowledgment. Not ID verification, safety clearance, ranking, or endorsement. Only admins via service role manage eligibility.';
comment on function public.public_active_member_badges(uuid[]) is 'Read-only public activity badge lookup for up to 100 published companion public IDs.';
