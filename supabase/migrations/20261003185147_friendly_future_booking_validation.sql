create or replace function public.create_booking_request(
  p_companion_public_id uuid,
  p_category text,
  p_meeting_mode text,
  p_requested_for timestamptz,
  p_duration_minutes integer,
  p_note text default ''
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  companion_row public.companion_listings%rowtype;
  customer_name text;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  if p_requested_for is null or p_requested_for <= now() then
    raise exception 'Choose a future date and time for your booking';
  end if;

  select * into companion_row
  from public.companion_listings
  where public_id = p_companion_public_id
    and published
    and moderation_status = 'active'
  limit 1;

  if not found then raise exception 'Companion is unavailable'; end if;
  if companion_row.user_id = uid then raise exception 'You cannot book your own profile'; end if;

  select display_name into customer_name
  from public.member_profiles
  where user_id = uid;

  if customer_name is null then
    raise exception 'Create your profile before sending a booking request';
  end if;

  if p_category is null or not (p_category = any(companion_row.categories)) then
    raise exception 'Choose an experience offered by this companion';
  end if;

  if p_meeting_mode not in ('online','in-person') then
    raise exception 'Choose a valid meeting type';
  end if;

  if companion_row.meeting_mode <> 'both' and companion_row.meeting_mode <> p_meeting_mode then
    raise exception 'This companion does not offer that meeting type';
  end if;

  insert into public.booking_requests(
    customer_id, companion_id, companion_public_id,
    customer_display_name, companion_display_name,
    category, meeting_mode, requested_for, duration_minutes, note
  )
  values (
    uid, companion_row.user_id, companion_row.public_id,
    customer_name, companion_row.display_name,
    p_category, p_meeting_mode, p_requested_for, p_duration_minutes, coalesce(p_note,'')
  )
  returning id into new_id;

  return new_id;
end;
$$;
revoke all on function public.create_booking_request(uuid,text,text,timestamptz,integer,text) from public, anon;
grant execute on function public.create_booking_request(uuid,text,text,timestamptz,integer,text) to authenticated;
