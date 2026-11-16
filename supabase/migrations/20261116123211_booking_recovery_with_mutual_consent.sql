alter table public.booking_requests
 add column if not exists completed_at timestamptz,
 add column if not exists completed_by uuid,
 add column if not exists reopen_requested_by uuid,
 add column if not exists reopen_requested_at timestamptz,
 add column if not exists reopen_request_state text;
create table if not exists private.booking_recovery_audit (
 id bigint generated always as identity primary key,
 booking_id uuid not null, actor_id uuid, action text not null,
 reason text, created_at timestamptz not null default now()
);
alter table private.booking_recovery_audit enable row level security;
revoke all on private.booking_recovery_audit from public,anon,authenticated;

-- Keep all existing transition and immutable-field checks. Only a trusted
-- database routine may perform completed -> accepted; ordinary callers cannot.
do $migration$
declare src text; old_src text;
begin
 select pg_get_functiondef('private.enforce_booking_transition()'::regprocedure) into old_src;
 src := replace(old_src,'if not is_admin then','if not is_admin and not (current_user = ''postgres'' and old.status = ''completed'' and new.status = ''accepted'') then');
 if src=old_src then raise exception 'Unexpected booking transition guard definition'; end if;
 execute src;
end $migration$;

create or replace function private.guard_booking_recovery_metadata()
returns trigger language plpgsql set search_path = '' as $$
begin
 if current_user <> 'postgres' and (
   new.completed_at is distinct from old.completed_at or
   new.completed_by is distinct from old.completed_by or
   new.reopen_requested_by is distinct from old.reopen_requested_by or
   new.reopen_requested_at is distinct from old.reopen_requested_at or
   new.reopen_request_state is distinct from old.reopen_request_state
 ) then raise exception 'Recovery information can only be changed by the booking recovery service'; end if;
 if old.status='completed' and new.status='accepted' then
   if current_user <> 'postgres' then raise exception 'Use the booking recovery service to reopen'; end if;
   if exists(select 1 from public.booking_reviews r where r.booking_id=old.id)
      or exists(select 1 from public.user_blocks u where (u.blocker_id=old.customer_id and u.blocked_id=old.companion_id) or (u.blocker_id=old.companion_id and u.blocked_id=old.customer_id))
   then raise exception 'A reviewed or blocked booking cannot be reopened'; end if;
   new.reopen_request_state := 'reopened';
 elsif old.status='accepted' and new.status='completed' then
   new.completed_at := clock_timestamp();
   new.completed_by := auth.uid();
   new.reopen_requested_by := null;
   new.reopen_requested_at := null;
   new.reopen_request_state := null;
 end if;
 return new;
end $$;
drop trigger if exists booking_recovery_metadata on public.booking_requests;
create trigger booking_recovery_metadata before update on public.booking_requests
for each row execute function private.guard_booking_recovery_metadata();

-- Trigger runs with owner privileges only to log the actual completion actor.
create or replace function private.audit_booking_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if old.status='accepted' and new.status='completed' then
   insert into private.booking_recovery_audit(booking_id,actor_id,action)
   values(new.id,auth.uid(),'completed');
 end if;
 return new;
end $$;
revoke all on function private.audit_booking_completion() from public,anon,authenticated;
drop trigger if exists booking_completion_audit on public.booking_requests;
create trigger booking_completion_audit after update of status on public.booking_requests
for each row execute function private.audit_booking_completion();

-- Public RPC is deliberately narrow: caller, participant/admin, row lock,
-- status, block/review and time checks are enforced on the server.
create or replace function public.booking_recovery_action(p_booking_id uuid,p_action text,p_reason text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); b public.booking_requests%rowtype; admin_ok boolean; other_id uuid; target uuid;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 select * into b from public.booking_requests where id=p_booking_id for update;
 if not found then raise exception 'Booking unavailable'; end if;
 select exists(select 1 from public.platform_admins a where a.user_id=uid) into admin_ok;
 if p_action='admin_reopen' then
   if not admin_ok then raise exception 'Admin access required'; end if;
   if char_length(trim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'Enter a reason (5 to 500 characters)'; end if;
 elsif uid not in (b.customer_id,b.companion_id) then raise exception 'Booking unavailable';
 end if;
 if b.status <> 'completed' then raise exception 'Only completed bookings can be reopened'; end if;
 if exists(select 1 from public.user_blocks u where (u.blocker_id=b.customer_id and u.blocked_id=b.companion_id) or (u.blocker_id=b.companion_id and u.blocked_id=b.customer_id))
 or exists(select 1 from public.booking_reviews r where r.booking_id=b.id) then raise exception 'This booking cannot be reopened because of a safety or review restriction'; end if;
 other_id := case when uid=b.customer_id then b.companion_id else b.customer_id end;
 if p_action='undo' then
   if b.completed_by is distinct from uid or b.completed_at is null or clock_timestamp()>b.completed_at+interval '30 seconds' then raise exception 'Undo expired. Request to reopen instead'; end if;
 elsif p_action='request' then
   if b.reopen_request_state in ('pending','declined') then raise exception 'A reopen request has already been made for this completion'; end if;
   update public.booking_requests set reopen_requested_by=uid,reopen_requested_at=clock_timestamp(),reopen_request_state='pending' where id=b.id;
   insert into public.notifications(user_id,kind,title,body,link) values(other_id,'booking','Reopen requested','The other participant would like to reopen this completed booking. You can accept or decline.','bookings.html?id='||b.id::text);
   insert into private.booking_recovery_audit(booking_id,actor_id,action) values(b.id,uid,'request');
   return 'pending';
 elsif p_action in ('approve','decline') then
   if b.reopen_request_state is distinct from 'pending' or b.reopen_requested_by is distinct from other_id then raise exception 'Only the other participant can respond to a pending reopen request'; end if;
   if p_action='decline' then
     update public.booking_requests set reopen_request_state='declined' where id=b.id;
     insert into public.notifications(user_id,kind,title,body,link) values(other_id,'booking','Reopen declined','Your reopen request was declined. The booking remains completed.','bookings.html?id='||b.id::text);
     insert into private.booking_recovery_audit(booking_id,actor_id,action) values(b.id,uid,'decline');
     return 'declined';
   end if;
 elsif p_action is distinct from 'admin_reopen' then raise exception 'Unknown recovery action';
 end if;
 update public.booking_requests set status='accepted' where id=b.id;
 insert into private.booking_recovery_audit(booking_id,actor_id,action,reason) values(b.id,uid,p_action,case when p_action='admin_reopen' then trim(p_reason) else null end);
 insert into public.notifications(user_id,kind,title,body,link)
 select x,'booking','Booking reopened','This booking is active again. You can resume the conversation if you wish.','chat.html?booking='||b.id::text
 from (values(b.customer_id),(b.companion_id)) v(x);
 return 'accepted';
end $$;
revoke all on function public.booking_recovery_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.booking_recovery_action(uuid,text,text) to authenticated;

-- Existing booking update guard rejects same-status writes by participants,
-- including metadata-only requests. Allow only the recovery RPC owner to
-- change recovery metadata while the booking stays completed.
do $migration$
declare src text; old_src text;
begin
 select pg_get_functiondef('private.enforce_booking_transition()'::regprocedure) into old_src;
 src := replace(old_src,'current_user = ''postgres'' and old.status = ''completed'' and new.status = ''accepted''','current_user = ''postgres'' and old.status = ''completed'' and new.status in (''accepted'',''completed'')');
 if src=old_src then raise exception 'Unexpected recovery guard definition'; end if;
 execute src;
end $migration$;

-- Do not emit a second ordinary "accepted" notification for a reopened booking.
do $migration$
declare src text; old_src text;
begin
 select pg_get_functiondef('private.notify_booking_change()'::regprocedure) into old_src;
 src := replace(old_src,'if new.status=''accepted'' then','if old.status=''completed'' and new.status=''accepted'' then return new; elsif new.status=''accepted'' then');
 if src=old_src then raise exception 'Unexpected booking notification definition'; end if;
 execute src;
end $migration$;
