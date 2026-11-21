-- Secure, per-admin new activity markers and unresolved issue counts.
create table if not exists public.admin_sidebar_seen (
  admin_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (section in ('users','bookings','contributions')),
  seen_through timestamptz not null,
  primary key (admin_id,section)
);
alter table public.admin_sidebar_seen enable row level security;
revoke all on public.admin_sidebar_seen from public,anon,authenticated;

create or replace function public.sathivo_admin_sidebar_badges()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_admin uuid := auth.uid();
 v_snapshot timestamptz := clock_timestamp();
 v_users timestamptz;
 v_bookings timestamptz;
 v_contributions timestamptz;
begin
 if v_admin is null or not exists (
   select 1 from public.platform_admins where user_id=v_admin
 ) then
   raise exception 'Admin access required' using errcode='42501';
 end if;
 insert into public.admin_sidebar_seen(admin_id,section,seen_through)
 values (v_admin,'users',v_snapshot),
        (v_admin,'bookings',v_snapshot),
        (v_admin,'contributions',v_snapshot)
 on conflict (admin_id,section) do nothing;
 select seen_through into v_users from public.admin_sidebar_seen where admin_id=v_admin and section='users';
 select seen_through into v_bookings from public.admin_sidebar_seen where admin_id=v_admin and section='bookings';
 select seen_through into v_contributions from public.admin_sidebar_seen where admin_id=v_admin and section='contributions';
 return jsonb_build_object(
   'snapshot',v_snapshot,
   'users',(select count(*) from auth.users where created_at>v_users),
   'bookings',(select count(*) from public.booking_requests where created_at>v_bookings),
   'support',(select count(*) from public.support_requests where category is distinct from 'feedback' and status='open'),
   'feedback',(select count(*) from public.support_requests where category='feedback' and status='open'),
   'contributions',(select count(*) from public.contribution_orders where verified_at is not null and verified_payment_id is not null and verified_at>v_contributions),
   'reports',(select count(*) from public.user_reports where status='open')
 );
end;
$$;
revoke all on function public.sathivo_admin_sidebar_badges() from public,anon,authenticated;
grant execute on function public.sathivo_admin_sidebar_badges() to authenticated;

create or replace function public.sathivo_admin_mark_sidebar_seen(p_section text,p_seen_through timestamptz)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_admin uuid := auth.uid();
begin
 if v_admin is null or not exists (
   select 1 from public.platform_admins where user_id=v_admin
 ) then raise exception 'Admin access required' using errcode='42501';end if;
 if p_section not in ('users','bookings','contributions') or p_section is null or p_seen_through is null then
   raise exception 'Invalid section or snapshot' using errcode='22023';
 end if;
 insert into public.admin_sidebar_seen(admin_id,section,seen_through)
 values(v_admin,p_section,least(p_seen_through,clock_timestamp()))
 on conflict(admin_id,section) do update set seen_through=greatest(public.admin_sidebar_seen.seen_through,excluded.seen_through);
end;
$$;
revoke all on function public.sathivo_admin_mark_sidebar_seen(text,timestamptz) from public,anon,authenticated;
grant execute on function public.sathivo_admin_mark_sidebar_seen(text,timestamptz) to authenticated;
