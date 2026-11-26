CREATE OR REPLACE FUNCTION private.founder_guard_new_marketplace()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare paused boolean; target uuid;
begin
 select exists(select 1 from public.founder_controls where kind='feature' and control_key='marketplace_new_activity' and not enabled) into paused;
 if tg_table_name='booking_requests' then
  if paused then raise exception 'Sathivo: New marketplace activity is temporarily paused.'; end if;
  if exists(select 1 from public.founder_member_restrictions where restricted and user_id in(new.customer_id,new.companion_id)) then raise exception 'Sathivo: This booking is unavailable due to an account restriction.'; end if;
 elsif tg_table_name='booking_messages' then
  if exists(select 1 from public.founder_member_restrictions where restricted and user_id=new.sender_id) then raise exception 'Sathivo: Your marketplace messaging is restricted. Contact support.'; end if;
 elsif tg_table_name='member_profiles' then
  -- Existing profile upserts also fire BEFORE INSERT, so allow existing rows.
  if exists(select 1 from public.member_profiles where user_id=new.user_id) then return new; end if;
  if paused or exists(select 1 from public.founder_controls where kind='feature' and control_key='profile_onboarding' and not enabled) then raise exception 'Sathivo: New profile setup is temporarily paused.'; end if;
 elsif tg_table_name='companion_listings' then
  if not new.published then return new; end if;
  if tg_op='UPDATE' then if old.published then return new; end if;
  elsif exists(select 1 from public.companion_listings where user_id=new.user_id and published) then return new; end if;
  if paused or exists(select 1 from public.founder_controls where kind='feature' and control_key='new_publications' and not enabled) then raise exception 'Sathivo: New companion publication is temporarily paused.'; end if;
  if exists(select 1 from public.founder_member_restrictions where restricted and user_id=new.user_id) then raise exception 'Sathivo: Your marketplace activity is restricted. Contact support.'; end if;
 end if;
 return new;
end $function$
