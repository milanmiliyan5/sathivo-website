-- Owner-scoped, one-time safety report thank-you notice. No report changes.
create table public.safety_report_thanks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 report_id uuid not null unique references public.user_reports(id) on delete cascade,
 recipient_name text not null check (length(trim(recipient_name)) between 2 and 80),
 issued_at timestamptz not null default now(),
 seen_at timestamptz
);
create index safety_report_thanks_pending_idx on public.safety_report_thanks(user_id,issued_at desc) where seen_at is null;
alter table public.safety_report_thanks enable row level security;
revoke all on public.safety_report_thanks from public,anon,authenticated;
grant select on public.safety_report_thanks to authenticated;
grant all on public.safety_report_thanks to service_role;
create policy safety_report_thanks_owner_read
 on public.safety_report_thanks for select to authenticated
 using (user_id=(select auth.uid()));
-- Signed-in recipient only; retries remain safe if another tab already saw the notice.
create function public.sathivo_acknowledge_safety_thanks(p_notice_id uuid)
 returns boolean language plpgsql security definer set search_path='' as $fn$
 declare v_uid uuid := auth.uid();
 begin
  if v_uid is null then raise exception 'Sign in first' using errcode='42501'; end if;
  update public.safety_report_thanks set seen_at=now()
   where id=p_notice_id and user_id=v_uid and seen_at is null;
  if found then return true; end if;
  return exists(select 1 from public.safety_report_thanks where id=p_notice_id and user_id=v_uid and seen_at is not null);
 end $fn$;
revoke all on function public.sathivo_acknowledge_safety_thanks(uuid) from public,anon,authenticated;
grant execute on function public.sathivo_acknowledge_safety_thanks(uuid) to authenticated;
