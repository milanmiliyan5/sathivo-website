create or replace function public.admin_dashboard_stats_server_v2()
returns table(
  total_accounts bigint,
  bookings_today bigint,
  total_bookings bigint,
  male_users bigint,
  female_users bigint,
  gender_other_or_unset bigint,
  pending_bookings bigint,
  accepted_bookings bigint,
  declined_bookings bigint,
  cancelled_bookings bigint,
  completed_bookings bigint,
  published_companions bigint,
  open_reports bigint,
  open_support bigint
)
language sql
security definer
set search_path to ''
as $$
  with genders as (
    select
      u.id,
      coalesce(mp.gender, nullif(u.raw_user_meta_data ->> 'gender','')) as gender
    from auth.users u
    left join public.member_profiles mp on mp.user_id = u.id
  ),
  stats as (
    select
      (select count(*)::bigint from genders) as total_accounts,
      (select count(*)::bigint
         from public.booking_requests br
        where (br.created_at at time zone 'Asia/Kolkata')::date =
              (now() at time zone 'Asia/Kolkata')::date) as bookings_today,
      (select count(*)::bigint from public.booking_requests) as total_bookings,
      (select count(*)::bigint from genders g where g.gender = 'male') as male_users,
      (select count(*)::bigint from genders g where g.gender = 'female') as female_users,
      (select count(*)::bigint from public.booking_requests where status='pending') as pending_bookings,
      (select count(*)::bigint from public.booking_requests where status='accepted') as accepted_bookings,
      (select count(*)::bigint from public.booking_requests where status='declined') as declined_bookings,
      (select count(*)::bigint from public.booking_requests where status='cancelled') as cancelled_bookings,
      (select count(*)::bigint from public.booking_requests where status='completed') as completed_bookings,
      (select count(*)::bigint from public.companion_listings where published and moderation_status='active') as published_companions,
      (select count(*)::bigint from public.user_reports where status='open') as open_reports,
      (select count(*)::bigint from public.support_requests where status in ('open','reviewed')) as open_support
  )
  select
    s.total_accounts,
    s.bookings_today,
    s.total_bookings,
    s.male_users,
    s.female_users,
    greatest(s.total_accounts-s.male_users-s.female_users,0::bigint),
    s.pending_bookings,
    s.accepted_bookings,
    s.declined_bookings,
    s.cancelled_bookings,
    s.completed_bookings,
    s.published_companions,
    s.open_reports,
    s.open_support
  from stats s;
$$;

revoke all on function public.admin_dashboard_stats_server_v2() from public, anon, authenticated;
grant execute on function public.admin_dashboard_stats_server_v2() to service_role;
