begin;
-- One bounded, read-only admin analytics request per manual dashboard refresh.
create function sathivo_rpc_internal.admin_visual_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 today date:=(now() at time zone 'Asia/Kolkata')::date;
 start_day date:=today-29;
 payload jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.platform_admins where user_id=auth.uid()) then
   raise exception 'Admin access required' using errcode='42501';
 end if;
 with days as (select start_day+i as day from generate_series(0,29) i),
 visitors as (
   select visit_date as day,count(*) as n from public.site_daily_visitors where visit_date between start_day and today group by visit_date
 ),
 signups as (
   select (created_at at time zone 'Asia/Kolkata')::date as day,count(*) as n from auth.users
   where created_at>=start_day::timestamp at time zone 'Asia/Kolkata' and created_at<(today+1)::timestamp at time zone 'Asia/Kolkata' group by 1
 ),
 bookings as (
   select (created_at at time zone 'Asia/Kolkata')::date as day,count(*) as n from public.booking_requests
   where created_at>=start_day::timestamp at time zone 'Asia/Kolkata' and created_at<(today+1)::timestamp at time zone 'Asia/Kolkata' group by 1
 ),
 cities as (
   select min(btrim(city_name)) as city,count(*) as n from public.companion_listings
   where published and moderation_status='active' and nullif(btrim(city_name),'') is not null
   group by lower(btrim(city_name)) order by n desc,city limit 8
 ),
 ranked as (
   select l.display_name,s.points,s.completed_count,s.public_id from top_companions_internal.snapshot s
   join public.companion_listings l on l.public_id=s.public_id join auth.users u on u.id=l.user_id
   where l.published and l.moderation_status='active' and l.adult_confirmed and l.boundaries_accepted
    and l.email_verified_at is not null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
    and not exists(select 1 from top_companions_internal.opt_out o where o.user_id=l.user_id) and s.points>100
   order by s.points desc,s.public_id limit 5
 )
 select jsonb_build_object(
 'calculated_at',now(),
 'days',(select jsonb_agg(jsonb_build_object('day',d.day,'visitors',coalesce(v.n,0),'signups',coalesce(s.n,0),'bookings',coalesce(b.n,0)) order by d.day)
 from days d left join visitors v using(day) left join signups s using(day) left join bookings b using(day)),
 'cities',coalesce((select jsonb_agg(jsonb_build_object('city',city,'count',n) order by n desc,city) from cities),'[]'::jsonb),
 'top_companions',coalesce((select jsonb_agg(jsonb_build_object('name',display_name,'points',points,'completed',completed_count) order by points desc,public_id) from ranked),'[]'::jsonb)
 ) into payload;
 return payload;
end $$;
revoke all on function sathivo_rpc_internal.admin_visual_summary() from public,anon,authenticated;
grant execute on function sathivo_rpc_internal.admin_visual_summary() to authenticated;
create function public.admin_visual_summary() returns jsonb language sql stable security invoker set search_path='' as $$select sathivo_rpc_internal.admin_visual_summary()$$;
revoke all on function public.admin_visual_summary() from public,anon,authenticated;
grant execute on function public.admin_visual_summary() to authenticated;
commit;