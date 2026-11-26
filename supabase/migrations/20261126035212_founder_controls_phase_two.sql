begin;
insert into public.founder_controls(kind,control_key) values
 ('feature','profile_onboarding'),('feature','new_publications'),('feature','new_contributions'),('feature','marketplace_new_activity')
 on conflict do nothing;

create table public.founder_member_restrictions(
 user_id uuid primary key references auth.users(id) on delete cascade,
 restricted boolean not null default true,
 reason text not null check(char_length(btrim(reason)) between 5 and 300),
 updated_at timestamptz not null default now()
);
create table public.founder_member_notices(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 message text not null check(char_length(btrim(message)) between 5 and 400),
 created_at timestamptz not null default now()
);
alter table public.founder_member_restrictions enable row level security;
alter table public.founder_member_notices enable row level security;
revoke all on public.founder_member_restrictions,public.founder_member_notices from public,anon,authenticated;
grant select on public.founder_member_restrictions,public.founder_member_notices to authenticated;
grant insert(user_id,restricted,reason),update(restricted,reason) on public.founder_member_restrictions to authenticated;
grant insert(user_id,message) on public.founder_member_notices to authenticated;
create policy founder_member_restriction_read on public.founder_member_restrictions for select to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
create policy founder_member_restriction_insert on public.founder_member_restrictions for insert to authenticated with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
create policy founder_member_restriction_update on public.founder_member_restrictions for update to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner')) with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
create policy founder_member_notice_read on public.founder_member_notices for select to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
create policy founder_member_notice_insert on public.founder_member_notices for insert to authenticated with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));

create function private.founder_restriction_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); previous boolean;
begin
 if actor is null or not exists(select 1 from public.platform_admins where user_id=actor and role='owner') then raise exception 'Owner access required' using errcode='42501'; end if;
 if exists(select 1 from public.platform_admins where user_id=new.user_id) then raise exception 'Admin accounts cannot be restricted' using errcode='42501'; end if;
 if tg_op='UPDATE' then previous:=old.restricted; else previous:=false; end if;
 new.updated_at=now();
 if previous is distinct from new.restricted then
  insert into public.founder_audit(actor_id,action,target,before_value,after_value) values(actor,'member_restriction',new.user_id::text,previous::text,new.restricted::text);
  insert into public.notifications(user_id,kind,title,body,link) values(new.user_id,'safety',case when new.restricted then 'Marketplace activity restricted' else 'Marketplace activity restored' end,case when new.restricted then 'New booking and message actions are restricted. Reason: '||btrim(new.reason)||'. Contact support for review.' else 'Your marketplace activity restriction has been lifted.' end,'support.html');
 end if;
 return new;
end $$;
revoke all on function private.founder_restriction_audit() from public,anon,authenticated;
create trigger founder_member_restriction_audit before insert or update on public.founder_member_restrictions for each row execute function private.founder_restriction_audit();
create function private.founder_notice_delivery() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.platform_admins where user_id=actor and role='owner') then raise exception 'Owner access required' using errcode='42501'; end if;
 if (select count(*) from public.founder_member_notices where user_id=new.user_id and created_at>now()-interval '1 hour')>=5 then raise exception 'Notice limit reached; try later'; end if;
 insert into public.notifications(user_id,kind,title,body,link) values(new.user_id,'safety','Sathivo account notice',btrim(new.message),'support.html');
 insert into public.founder_audit(actor_id,action,target,after_value) values(actor,'member_notice',new.user_id::text,new.id::text);
 return new;
end $$;
revoke all on function private.founder_notice_delivery() from public,anon,authenticated;
create trigger founder_member_notice_delivery before insert on public.founder_member_notices for each row execute function private.founder_notice_delivery();

create function private.founder_guard_new_marketplace() returns trigger language plpgsql security definer set search_path='' as $$
declare paused boolean; target uuid;
begin
 select exists(select 1 from public.founder_controls where kind='feature' and control_key='marketplace_new_activity' and not enabled) into paused;
 if tg_table_name='booking_requests' then
  if paused then raise exception 'Sathivo: New marketplace activity is temporarily paused.'; end if;
  if exists(select 1 from public.founder_member_restrictions where restricted and user_id in(new.customer_id,new.companion_id)) then raise exception 'Sathivo: This booking is unavailable due to an account restriction.'; end if;
 elsif tg_table_name='booking_messages' then
  if exists(select 1 from public.founder_member_restrictions where restricted and user_id=new.sender_id) then raise exception 'Sathivo: Your marketplace messaging is restricted. Contact support.'; end if;
 elsif tg_table_name='member_profiles' then
  if paused or exists(select 1 from public.founder_controls where kind='feature' and control_key='profile_onboarding' and not enabled) then raise exception 'Sathivo: New profile setup is temporarily paused.'; end if;
 elsif tg_table_name='companion_listings' then
  if not new.published then return new; end if;
  if tg_op='UPDATE' then if old.published then return new; end if; end if;
  if paused or exists(select 1 from public.founder_controls where kind='feature' and control_key='new_publications' and not enabled) then raise exception 'Sathivo: New companion publication is temporarily paused.'; end if;
  if exists(select 1 from public.founder_member_restrictions where restricted and user_id=new.user_id) then raise exception 'Sathivo: Your marketplace activity is restricted. Contact support.'; end if;
 end if;
 return new;
end $$;
revoke all on function private.founder_guard_new_marketplace() from public,anon,authenticated;
create trigger founder_guard_new_bookings before insert on public.booking_requests for each row execute function private.founder_guard_new_marketplace();
create trigger founder_guard_new_messages before insert on public.booking_messages for each row execute function private.founder_guard_new_marketplace();
create trigger founder_guard_new_profiles before insert on public.member_profiles for each row execute function private.founder_guard_new_marketplace();
create trigger founder_guard_new_publications before insert or update of published on public.companion_listings for each row execute function private.founder_guard_new_marketplace();

-- Gate new payment reservations only; existing orders, reconciliation and webhook processing are untouched.
create or replace function public.reserve_contribution_order(p_id uuid,p_user uuid,p_amount integer)
returns boolean language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.contribution_settings where singleton and live_enabled) then return false; end if;
 if exists(select 1 from public.founder_controls where kind='feature' and control_key='new_contributions' and not enabled) then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,71939));
 if (select count(*) from public.contribution_orders where user_id=p_user and created_at>now()-interval '1 hour')>=5 then return false; end if;
 insert into public.contribution_orders(id,user_id,amount_paise) values(p_id,p_user,p_amount) on conflict do nothing;
 return found;
end $$;
grant select on public.founder_controls to service_role;
revoke execute on function public.reserve_contribution_order(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_contribution_order(uuid,uuid,integer) to service_role;
commit;