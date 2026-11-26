begin;
create table public.founder_controls (
 kind text not null check(kind in ('feature','activity')),
 control_key text not null check(length(control_key) between 1 and 80),
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 primary key(kind,control_key)
);
create table public.founder_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null,
 action text not null,
 target text not null,
 before_value text,
 after_value text,
 created_at timestamptz not null default now()
);
alter table public.founder_controls enable row level security;
alter table public.founder_audit enable row level security;
revoke all on public.founder_controls,public.founder_audit from public,anon,authenticated;
grant select on public.founder_controls,public.founder_audit to authenticated;
grant update(enabled) on public.founder_controls to authenticated;
create policy founder_controls_read on public.founder_controls for select to authenticated using (exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
create policy founder_controls_update on public.founder_controls for update to authenticated using (exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner')) with check (exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
create policy founder_audit_read on public.founder_audit for select to authenticated using (exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
insert into public.founder_controls(kind,control_key) values ('feature','new_bookings'),('feature','chat_photos'),('feature','view_once_photos'),('activity','Conversation'),('activity','Coffee'),('activity','Movies'),('activity','Shopping'),('activity','Events'),('activity','Walking'),('activity','City Exploration'),('activity','College Projects Help'),('activity','Study Partner'),('activity','Language Practice'),('activity','Interview Practice'),('activity','Digital Help'),('activity','New City Buddy'),('activity','Hospital Visit Companion'),('activity','Appointment Companion'),('activity','Senior Social Companion'),('activity','Sports & Fitness Partner'),('activity','Gaming Partner'),('activity','Photography & Creative Partner'),('activity','Online chat'),('activity','Phone conversation');
create function private.founder_control_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.platform_admins a where a.user_id=actor and a.role='owner') then
  raise exception 'Owner access required' using errcode='42501';
 end if;
 if old.enabled is distinct from new.enabled then
  new.updated_at=now();
  insert into public.founder_audit(actor_id,action,target,before_value,after_value)
  values(actor,'control_change',new.kind||':'||new.control_key,old.enabled::text,new.enabled::text);
 end if;
 return new;
end $$;
revoke all on function private.founder_control_audit() from public,anon,authenticated;
create trigger founder_control_audit before update on public.founder_controls for each row execute function private.founder_control_audit();
create function private.founder_guard_booking() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.founder_controls where kind='feature' and control_key='new_bookings' and not enabled) then
  raise exception 'Sathivo: New booking requests are temporarily paused.' using errcode='P0001';
 end if;
 if exists(select 1 from public.founder_controls where kind='activity' and control_key=new.category and not enabled) then
  raise exception 'Sathivo: This activity is temporarily unavailable for new bookings.' using errcode='P0001';
 end if;
 return new;
end $$;
revoke all on function private.founder_guard_booking() from public,anon,authenticated;
create trigger founder_guard_booking before insert on public.booking_requests for each row execute function private.founder_guard_booking();
create function private.founder_guard_chat_photo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.message_type='image' then
  if exists(select 1 from public.founder_controls where kind='feature' and control_key='chat_photos' and not enabled) then
   raise exception 'Sathivo: Chat photo sharing is temporarily paused.' using errcode='P0001';
  end if;
  if new.view_once and exists(select 1 from public.founder_controls where kind='feature' and control_key='view_once_photos' and not enabled) then
   raise exception 'Sathivo: View-once photo sharing is temporarily paused.' using errcode='P0001';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.founder_guard_chat_photo() from public,anon,authenticated;
create trigger founder_guard_chat_photo before insert on public.booking_messages for each row execute function private.founder_guard_chat_photo();
create function private.founder_audit_moderation() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old_state text; new_state text; target_id text;
begin
 if actor is null or not exists(select 1 from public.platform_admins a where a.user_id=actor and a.role='owner') then return new; end if;
 if tg_table_name='companion_listings' then old_state=old.moderation_status; new_state=new.moderation_status; target_id=new.user_id::text;
 else old_state=old.status; new_state=new.status; target_id=new.id::text; end if;
 if old_state is distinct from new_state then
  insert into public.founder_audit(actor_id,action,target,before_value,after_value)
  values(actor,tg_table_name||'_status',target_id,old_state,new_state);
 end if;
 return new;
end $$;
revoke all on function private.founder_audit_moderation() from public,anon,authenticated;
create trigger founder_audit_support after update of status on public.support_requests for each row execute function private.founder_audit_moderation();
create trigger founder_audit_reports after update of status on public.user_reports for each row execute function private.founder_audit_moderation();
create trigger founder_audit_listing after update of moderation_status on public.companion_listings for each row execute function private.founder_audit_moderation();
commit;
