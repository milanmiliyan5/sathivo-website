
create schema if not exists extra_web_push_internal;
revoke all on schema extra_web_push_internal from public,anon,authenticated;
create table extra_web_push_internal.events (
 id bigint generated always as identity primary key,
 kind text not null check(kind in ('meeting','review','feature','publish')),
 event_key text not null,
 target_user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid,
 meeting_at timestamptz,
 title text not null, body text not null, url text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '1 day'),
 claimed_at timestamptz, finished_at timestamptz,
 sent integer, failed integer,
 unique(kind,event_key,target_user_id)
);
alter table extra_web_push_internal.events enable row level security;
revoke all on extra_web_push_internal.events from public,anon,authenticated;
create index extra_web_push_due_idx on extra_web_push_internal.events(created_at) where claimed_at is null;
create table extra_web_push_internal.announcements (
 id bigint generated always as identity primary key,
 actor uuid not null, body text not null, created_at timestamptz not null default now()
);
alter table extra_web_push_internal.announcements enable row level security;
revoke all on extra_web_push_internal.announcements from public,anon,authenticated;

create function extra_web_push_internal.on_review() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.booking_requests b where b.id=new.booking_id and b.status='completed' and b.customer_id=new.reviewer_id and b.companion_id=new.companion_id)
 and not exists(select 1 from public.user_blocks x where (x.blocker_id=new.reviewer_id and x.blocked_id=new.companion_id) or (x.blocker_id=new.companion_id and x.blocked_id=new.reviewer_id)) then
 insert into extra_web_push_internal.events(kind,event_key,target_user_id,subject_id,title,body,url)
 values('review',new.booking_id::text,new.companion_id,new.id,'You''ve received a new review! ⭐','Someone has shared their experience with you. Open Sathivo to view your new rating and review.','requests.html?id='||new.booking_id)
 on conflict do nothing;
 end if;
 return new;
exception when others then raise warning 'Optional review push could not be queued'; return new;
end $$;
revoke all on function extra_web_push_internal.on_review() from public,anon,authenticated;
create trigger extra_web_push_review after insert on public.booking_reviews for each row execute function extra_web_push_internal.on_review();

create function extra_web_push_internal.on_publish() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.published is true and new.moderation_status='active' then
 if tg_op='UPDATE' then
  if old.published is true then return new; end if;
 end if;
 insert into extra_web_push_internal.events(kind,event_key,target_user_id,subject_id,title,body,url)
 values('publish',new.public_id::text,new.user_id,new.public_id,'Your profile is now live! 🎉','Congratulations! Your Sathivo companion profile has been successfully published. You''re now discoverable by others.','companion.html?id='||new.public_id)
 on conflict do nothing;
 end if;
 return new;
exception when others then raise warning 'Optional profile push could not be queued'; return new;
end $$;
revoke all on function extra_web_push_internal.on_publish() from public,anon,authenticated;
create trigger extra_web_push_publish after insert or update of published on public.companion_listings for each row execute function extra_web_push_internal.on_publish();

create function public.authorize_extra_web_push(p_token text) returns boolean
language sql stable set search_path='' as $$
 select coalesce(length(p_token)=72 and exists(select 1 from booking_reminder_internal.config c where c.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')),false)
$$;
revoke all on function public.authorize_extra_web_push(text) from public,anon,authenticated;
grant execute on function public.authorize_extra_web_push(text) to service_role;

create function extra_web_push_internal.valid_event(e extra_web_push_internal.events) returns boolean
language sql stable set search_path='' as $$
 select e.expires_at>now() and exists(select 1 from auth.users u where u.id=e.target_user_id and (u.banned_until is null or u.banned_until<=now())) and
 case e.kind
 when 'meeting' then exists(select 1 from public.booking_requests b where b.id=e.subject_id and b.status='accepted' and b.requested_for=e.meeting_at and b.requested_for>now() and e.target_user_id in(b.customer_id,b.companion_id) and not exists(select 1 from public.user_blocks x where (x.blocker_id=b.customer_id and x.blocked_id=b.companion_id) or (x.blocker_id=b.companion_id and x.blocked_id=b.customer_id)))
 when 'review' then exists(select 1 from public.booking_reviews r join public.booking_requests b on b.id=r.booking_id where r.id=e.subject_id and r.companion_id=e.target_user_id and b.status='completed' and not exists(select 1 from public.user_blocks x where (x.blocker_id=r.reviewer_id and x.blocked_id=r.companion_id) or (x.blocker_id=r.companion_id and x.blocked_id=r.reviewer_id)))
 when 'publish' then exists(select 1 from public.companion_listings l where l.public_id=e.subject_id and l.user_id=e.target_user_id and l.published and l.moderation_status='active')
 when 'feature' then true
 else false end
$$;
revoke all on function extra_web_push_internal.valid_event(extra_web_push_internal.events) from public,anon,authenticated;

create function public.claim_extra_web_push(p_token text)
returns table(id bigint,kind text,target_user_id uuid,title text,body text,url text)
language plpgsql security definer set search_path='' as $$
begin
 if not public.authorize_extra_web_push(p_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
 return query with due as(
 select e.id from extra_web_push_internal.events e where e.claimed_at is null and e.expires_at>now()
 order by (e.kind='meeting') desc,e.created_at,e.id limit 20 for update skip locked
 ), changed as(
 update extra_web_push_internal.events e set claimed_at=now() from due where e.id=due.id returning e.*
 ) select c.id,c.kind,c.target_user_id,c.title,c.body,c.url from changed c;
end $$;
revoke all on function public.claim_extra_web_push(text) from public,anon,authenticated;
grant execute on function public.claim_extra_web_push(text) to service_role;

create function public.extra_web_push_still_valid(p_id bigint) returns boolean
language sql security definer stable set search_path='' as $$
 select coalesce((select extra_web_push_internal.valid_event(e) from extra_web_push_internal.events e where e.id=p_id and e.claimed_at is not null and e.finished_at is null),false)
$$;
revoke all on function public.extra_web_push_still_valid(bigint) from public,anon,authenticated;
grant execute on function public.extra_web_push_still_valid(bigint) to service_role;

create function public.finish_extra_web_push(p_id bigint,p_sent integer,p_failed integer) returns void
language sql security definer set search_path='' as $$
 update extra_web_push_internal.events set finished_at=now(),sent=greatest(0,p_sent),failed=greatest(0,p_failed) where id=p_id and claimed_at is not null and finished_at is null
$$;
revoke all on function public.finish_extra_web_push(bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.finish_extra_web_push(bigint,integer,integer) to service_role;

create function public.queue_sathivo_feature_push(p_body text) returns integer
language plpgsql security definer set search_path='' as $$
declare a_id bigint; n integer; msg text:=btrim(coalesce(p_body,''));
begin
 if auth.uid() is null or not exists(select 1 from public.platform_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501'; end if;
 if char_length(msg)<10 or char_length(msg)>180 then raise exception 'Enter 10 to 180 characters'; end if;
 perform pg_advisory_xact_lock(71261125);
 if exists(select 1 from extra_web_push_internal.announcements a where a.created_at>now()-interval '1 hour') then raise exception 'Only one feature announcement per hour'; end if;
 insert into extra_web_push_internal.announcements(actor,body) values(auth.uid(),msg) returning id into a_id;
 insert into extra_web_push_internal.events(kind,event_key,target_user_id,title,body,url)
 select distinct 'feature',a_id::text,s.user_id,'Something new on Sathivo! ✨',msg,'companions.html'
 from public.push_subscriptions s join auth.users u on u.id=s.user_id where u.banned_until is null or u.banned_until<=now()
 on conflict do nothing;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.queue_sathivo_feature_push(text) from public,anon;
grant execute on function public.queue_sathivo_feature_push(text) to authenticated;

create function extra_web_push_internal.tick() returns integer
language plpgsql set search_path='' as $$
declare n integer;
begin
 insert into extra_web_push_internal.events(kind,event_key,target_user_id,subject_id,meeting_at,title,body,url,expires_at)
 select 'meeting',b.id::text||':'||extract(epoch from b.requested_for)::text,v.uid,b.id,b.requested_for,'Your upcoming Sathivo meeting ⏰','Your scheduled companionship meeting is coming up. Open Sathivo to review your plans.',v.url,b.requested_for
 from public.booking_requests b cross join lateral(values(b.customer_id,'bookings.html?id='||b.id),(b.companion_id,'requests.html?id='||b.id)) v(uid,url)
 where b.status='accepted' and b.requested_for>now() and b.requested_for<=now()+interval '1 hour'
 and exists(select 1 from public.push_subscriptions s where s.user_id=v.uid)
 and not exists(select 1 from public.user_blocks x where (x.blocker_id=b.customer_id and x.blocked_id=b.companion_id) or (x.blocker_id=b.companion_id and x.blocked_id=b.customer_id))
 on conflict do nothing;
 get diagnostics n=row_count;
 if exists(select 1 from extra_web_push_internal.events e where e.claimed_at is null and e.expires_at>now()) then
 perform net.http_post(url:='https://ujutlzjsgbqtlisecpnh.supabase.co/functions/v1/extra-web-push',headers:=jsonb_build_object('Content-Type','application/json','x-sathivo-scheduler',(select decrypted_secret from vault.decrypted_secrets where name='sathivo_booking_reminder_scheduler_v1')),body:='{}'::jsonb,timeout_milliseconds:=30000);
 end if;
 return n;
end $$;
revoke all on function extra_web_push_internal.tick() from public,anon,authenticated;
select cron.schedule('sathivo-extra-web-push','* * * * *','select extra_web_push_internal.tick();');
