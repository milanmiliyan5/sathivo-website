-- Applied to the live Sathivo Supabase project on 2026-10-04.
-- Gender is self-selected profile data used only for aggregate admin statistics here.
alter table public.member_profiles
  add column if not exists gender text null;

alter table public.member_profiles
  drop constraint if exists member_profiles_gender_check;

alter table public.member_profiles
  add constraint member_profiles_gender_check
  check (gender is null or gender in ('male','female','other','prefer_not_to_say'));

create or replace function public.admin_dashboard_stats_server()
returns table(
  total_accounts bigint,
  bookings_today bigint,
  total_bookings bigint,
  male_users bigint,
  female_users bigint,
  gender_other_or_unset bigint
)
language sql
security definer
set search_path = ''
as $
  with genders as (
    select u.id, coalesce(mp.gender, nullif(u.raw_user_meta_data ->> 'gender','')) as gender
    from auth.users u
    left join public.member_profiles mp on mp.user_id = u.id
  ),
  stats as (
    select
      (select count(*)::bigint from genders) as total_accounts,
      (select count(*)::bigint from public.booking_requests br
        where (br.created_at at time zone 'Asia/Kolkata')::date =
              (now() at time zone 'Asia/Kolkata')::date) as bookings_today,
      (select count(*)::bigint from public.booking_requests) as total_bookings,
      (select count(*)::bigint from genders g where g.gender = 'male') as male_users,
      (select count(*)::bigint from genders g where g.gender = 'female') as female_users
  )
  select s.total_accounts,s.bookings_today,s.total_bookings,s.male_users,s.female_users,
         greatest(s.total_accounts-s.male_users-s.female_users,0::bigint)
  from stats s;
$;

revoke all on function public.admin_dashboard_stats_server() from public;
revoke all on function public.admin_dashboard_stats_server() from anon;
revoke all on function public.admin_dashboard_stats_server() from authenticated;
grant execute on function public.admin_dashboard_stats_server() to service_role;
