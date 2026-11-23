-- Mandatory per-account policy warning with user-specific acknowledgment and backend restrictions.
create table public.account_policy_warnings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_report_id uuid unique references public.user_reports(id) on delete set null,
 display_name text not null check (length(trim(display_name)) between 2 and 80),
 issued_at timestamptz not null default now(),
 acknowledged_at timestamptz,
 acknowledgement_text text,
 constraint swg_ack_pair check (
  (acknowledged_at is null and acknowledgement_text is null) or
  (acknowledged_at is not null and acknowledgement_text = 'I understand and agree to follow Sathivo''s Community Guidelines.')
 )
);
create index policy_warnings_pending_idx on public.account_policy_warnings(user_id,issued_at desc) where acknowledged_at is null;
alter table public.account_policy_warnings enable row level security;
revoke all on public.account_policy_warnings from public,anon,authenticated;
grant select on public.account_policy_warnings to authenticated;
grant all on public.account_policy_warnings to service_role;
create policy policy_warning_owner_admin_read on public.account_policy_warnings for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))
);
-- Members cannot modify a warning through the Data API. This authenticated RPC
-- checks the actual JWT identity, explicit consent and ownership of this warning.
create function public.sathivo_acknowledge_policy_warning(p_warning_id uuid,p_agreed boolean)
 returns boolean language plpgsql security definer set search_path='' as $fn$
 declare v_uid uuid := auth.uid();
 begin
  if v_uid is null or p_agreed is distinct from true then
   raise exception 'Please sign in and agree to the guidelines first' using errcode='42501';
  end if;
  update public.account_policy_warnings set
   acknowledged_at=now(),
   acknowledgement_text='I understand and agree to follow Sathivo''s Community Guidelines.'
   where id=p_warning_id and user_id=v_uid and acknowledged_at is null;
  return found;
 end $fn$;
revoke all on function public.sathivo_acknowledge_policy_warning(uuid,boolean) from public,anon;
grant execute on function public.sathivo_acknowledge_policy_warning(uuid,boolean) to authenticated;
-- Server trigger prevents bypass through another browser/client, protected RPCs,
-- or direct authenticated Data API writes, without blocking support or deletion.
create function public.sathivo_guard_pending_policy_warning()
 returns trigger language plpgsql security definer set search_path='' as $fn$
 declare v_uid uuid := auth.uid();
 begin
  if v_uid is not null and exists(
    select 1 from public.account_policy_warnings w
    where w.user_id=v_uid and w.acknowledged_at is null
  ) then
    raise exception 'Please acknowledge your Sathivo policy warning before using account features' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
 end $fn$;
revoke all on function public.sathivo_guard_pending_policy_warning() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array[
 'booking_requests','booking_messages','member_profiles','companion_listings','booking_reviews','companion_favorites'
 ] loop
 execute format(
  'create trigger guard_pending_warning_%I before insert or update or delete on public.%I for each row execute function public.sathivo_guard_pending_policy_warning()',
  t,t
 );
 end loop;
end $$;
