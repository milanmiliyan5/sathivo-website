
create schema if not exists top_companions_internal;
revoke all on schema top_companions_internal from public;
grant usage on schema top_companions_internal to anon,authenticated;
create table top_companions_internal.opt_out(user_id uuid primary key references auth.users(id) on delete cascade);
create table top_companions_internal.snapshot(public_id uuid primary key, points integer not null check(points>=100), completed_count bigint not null, review_count bigint not null, average_rating numeric, calculated_at timestamptz not null);
alter table top_companions_internal.opt_out enable row level security;
alter table top_companions_internal.snapshot enable row level security;
revoke all on all tables in schema top_companions_internal from public,anon,authenticated;
create function top_companions_internal.refresh_rankings() returns void language plpgsql set search_path='' as $$
declare cutoff timestamptz:=now(); start_at timestamptz:=cutoff-interval '30 days';
begin
 perform pg_advisory_xact_lock(72619304);
 delete from top_companions_internal.snapshot;
 insert into top_companions_internal.snapshot(public_id,points,completed_count,review_count,average_rating,calculated_at)
 with eligible as (
 select l.user_id,l.public_id from public.companion_listings l join auth.users u on u.id=l.user_id
 where l.published and l.moderation_status='active' and l.adult_confirmed and l.boundaries_accepted and l.email_verified_at is not null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=cutoff)
 ), bookings as (
 select b.* from public.booking_requests b where b.customer_id<>b.companion_id
 ), messages as (
 select m.booking_id,m.sender_id,m.created_at from public.booking_messages m join bookings b on b.id=m.booking_id where m.created_at>=start_at and m.created_at<cutoff and m.deleted_for_everyone_at is null and m.sender_id in (b.customer_id,b.companion_id)
 ), two_way as (
 select booking_id from messages group by booking_id having count(distinct sender_id)=2
 ), conversation_pairs as (
 select distinct m.sender_id as uid,case when m.sender_id=b.customer_id then b.companion_id else b.customer_id end as peer from messages m join two_way t using(booking_id) join bookings b on b.id=m.booking_id
 ), responses as (
 select distinct b.companion_id as uid,b.customer_id as peer,(d.created_at at time zone 'Asia/Kolkata')::date as day,d.event
 from public.push_delivery_events d join bookings b on b.id=d.booking_id
 where d.created_at>=start_at and d.created_at<cutoff and d.target_user_id=b.customer_id and ((d.event='accepted' and b.status in ('accepted','completed')) or (d.event='declined' and b.status='declined'))
 ), completed_recent as (
 select companion_id as uid,customer_id as peer,completed_at from bookings where status='completed' and completed_at>=start_at and completed_at<cutoff
 ), reviews as (
 select r.companion_id as uid,r.reviewer_id as peer,r.rating,r.created_at from public.booking_reviews r join bookings b on b.id=r.booking_id and b.companion_id=r.companion_id and b.customer_id=r.reviewer_id and b.status='completed'
 ), active_days as (
 select m.sender_id as uid,(m.created_at at time zone 'Asia/Kolkata')::date as day from messages m join two_way t using(booking_id)
 union select uid,day from responses
 union select uid,(completed_at at time zone 'Asia/Kolkata')::date from completed_recent
 ), daily as (select uid,least(count(*),30) as n from active_days group by uid),
 resp as (select uid,count(distinct peer) as n,count(distinct peer) filter(where event='accepted') as accepted from responses group by uid),
 conv as (select uid,count(*) as n from conversation_pairs group by uid),
 done_recent as (select uid,sum(least(n,3)) as n from (select uid,peer,count(*) as n from completed_recent group by uid,peer) x group by uid),
 done_all as (select companion_id as uid,count(*) as n from bookings where status='completed' group by companion_id),
 rev as (select uid,count(*) as n,round(avg(rating),2) as avg_rating,count(distinct peer) filter(where rating>=4 and created_at>=start_at and created_at<cutoff) as positive_recent from reviews group by uid)
 select e.public_id,(100+5*coalesce(d.n,0)+10*coalesce(r.n,0)+15*coalesce(r.accepted,0)+10*coalesce(c.n,0)+50*coalesce(dr.n,0)+20*coalesce(v.positive_recent,0))::integer,coalesce(da.n,0),coalesce(v.n,0),v.avg_rating,cutoff
 from eligible e left join daily d on d.uid=e.user_id left join resp r on r.uid=e.user_id left join conv c on c.uid=e.user_id left join done_recent dr on dr.uid=e.user_id left join done_all da on da.uid=e.user_id left join rev v on v.uid=e.user_id;
end $$;
revoke all on function top_companions_internal.refresh_rankings() from public,anon,authenticated;
create function top_companions_internal.read_rankings(p_category text) returns table(public_id uuid,display_name text,photo_path text,points integer,completed_count bigint,review_count bigint,average_rating numeric,calculated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select s.public_id,l.display_name,l.photo_path,s.points,s.completed_count,s.review_count,s.average_rating,s.calculated_at
 from top_companions_internal.snapshot s join public.companion_listings l on l.public_id=s.public_id join auth.users u on u.id=l.user_id
 where (auth.uid() is not null or auth.role()='anon') and l.published and l.moderation_status='active' and l.adult_confirmed and l.boundaries_accepted and l.email_verified_at is not null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
 and not exists(select 1 from top_companions_internal.opt_out o where o.user_id=l.user_id)
 and not exists(select 1 from public.user_blocks b where (b.blocker_id=auth.uid() and b.blocked_id=l.user_id) or (b.blocked_id=auth.uid() and b.blocker_id=l.user_id))
 and case p_category when 'active' then s.points>100 when 'booked' then s.completed_count>0 when 'rated' then s.review_count>=2 else false end
 order by case when p_category='active' then s.points end desc nulls last,case when p_category='booked' then s.completed_count end desc nulls last,case when p_category='rated' then s.average_rating end desc nulls last,case when p_category='rated' then s.review_count end desc nulls last,s.public_id limit 20
$$;
revoke all on function top_companions_internal.read_rankings(text) from public;
grant execute on function top_companions_internal.read_rankings(text) to anon,authenticated;
create function public.top_companions_rankings(p_category text default 'active') returns table(public_id uuid,display_name text,photo_path text,points integer,completed_count bigint,review_count bigint,average_rating numeric,calculated_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from top_companions_internal.read_rankings(p_category) $$;
revoke all on function public.top_companions_rankings(text) from public;
grant execute on function public.top_companions_rankings(text) to anon,authenticated;
create function top_companions_internal.preference(p_opt_out boolean default null) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_opt_out is true then insert into top_companions_internal.opt_out(user_id) values(uid) on conflict do nothing;
 elsif p_opt_out is false then delete from top_companions_internal.opt_out where user_id=uid; end if;
 return exists(select 1 from top_companions_internal.opt_out where user_id=uid);
end $$;
revoke all on function top_companions_internal.preference(boolean) from public,anon;
grant execute on function top_companions_internal.preference(boolean) to authenticated;
create function public.top_companions_preference(p_opt_out boolean default null) returns boolean language sql volatile security invoker set search_path='' as $$ select top_companions_internal.preference(p_opt_out) $$;
revoke all on function public.top_companions_preference(boolean) from public,anon;
grant execute on function public.top_companions_preference(boolean) to authenticated;
select top_companions_internal.refresh_rankings();
select cron.schedule('sathivo-top-companions-daily','30 18 * * *','select top_companions_internal.refresh_rankings();');
