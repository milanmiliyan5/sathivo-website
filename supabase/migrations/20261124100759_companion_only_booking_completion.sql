-- Companion-only completion; preserve previous records and recovery.
CREATE OR REPLACE FUNCTION private.guard_mutual_booking_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid();
begin
 if tg_op='INSERT' then
  if new.customer_completion_confirmed_at is not null or new.companion_completion_confirmed_at is not null then
   raise exception 'New bookings cannot include completion confirmations';
  end if;
  return new;
 end if;
 if new.customer_completion_confirmed_at is distinct from old.customer_completion_confirmed_at
    or new.companion_completion_confirmed_at is distinct from old.companion_completion_confirmed_at then
  raise exception 'Completion metadata is managed by the booking service';
 end if;
 if old.status='accepted' and new.status='completed' then
  if uid is distinct from old.companion_id or uid is null then
   raise exception 'Only the booked companion can complete this booking' using errcode='42501';
  end if;
  if exists(select 1 from public.user_blocks u where
   (u.blocker_id=old.customer_id and u.blocked_id=old.companion_id) or
   (u.blocker_id=old.companion_id and u.blocked_id=old.customer_id)) then
   raise exception 'Completion is unavailable for blocked bookings';
  end if;
  new.companion_completion_confirmed_at:=clock_timestamp();
 elsif (old.status='completed' and new.status='accepted') or (old.status='accepted' and new.status='cancelled') then
  new.customer_completion_confirmed_at:=null;
  new.companion_completion_confirmed_at:=null;
 end if;
 return new;
end $function$;
CREATE OR REPLACE FUNCTION private.enforce_booking_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  uid uuid := auth.uid();
  is_admin boolean;
  cancelling boolean := old.status in ('pending','accepted') and new.status = 'cancelled' and new.status is distinct from old.status;
begin
  select exists(select 1 from public.platform_admins a where a.user_id=uid) into is_admin;

  if new.customer_id is distinct from old.customer_id
     or new.companion_id is distinct from old.companion_id
     or new.companion_public_id is distinct from old.companion_public_id
     or new.category is distinct from old.category
     or new.meeting_mode is distinct from old.meeting_mode
     or new.requested_for is distinct from old.requested_for
     or new.duration_minutes is distinct from old.duration_minutes
     or new.note is distinct from old.note
     or new.created_at is distinct from old.created_at
     or new.listed_hourly_rate is distinct from old.listed_hourly_rate
     or new.offered_hourly_rate is distinct from old.offered_hourly_rate then
    raise exception 'Booking details cannot be changed after the request is sent';
  end if;

  if new.agreed_hourly_rate is distinct from old.agreed_hourly_rate then
    raise exception 'The agreed rate is set automatically when a request is accepted';
  end if;

  if not cancelling and (
    new.cancel_reason is distinct from old.cancel_reason
    or new.cancel_note is distinct from old.cancel_note
    or new.cancelled_by is distinct from old.cancelled_by
    or new.cancelled_at is distinct from old.cancelled_at
  ) then
    raise exception 'Cancellation details can only be set while cancelling a booking';
  end if;

  if not is_admin and not (current_user = 'postgres' and old.status = 'completed' and new.status in ('accepted','completed')) then
    if uid = old.customer_id then
      if not (old.status in ('pending','accepted') and new.status='cancelled') then
        raise exception 'Customers can only cancel pending or accepted requests';
      end if;
    elsif uid = old.companion_id then
      if not (
        (old.status='pending' and new.status in ('accepted','declined'))
        or (old.status='accepted' and new.status in ('completed','cancelled'))
      ) then
        raise exception 'This booking status change is not allowed';
      end if;
    else
      raise exception 'Not allowed to change this booking';
    end if;

    if cancelling then
      if coalesce(new.cancel_reason,'') not in ('plan_changed','time_issue','safety_concern','other') then
        raise exception 'Choose a cancellation reason';
      end if;
      if new.cancel_reason='other' and char_length(trim(coalesce(new.cancel_note,''))) < 3 then
        raise exception 'Add a short note for Other';
      end if;
      new.cancelled_by := uid;
      new.cancelled_at := now();
    end if;
  elsif cancelling then
    new.cancelled_by := coalesce(new.cancelled_by,uid);
    new.cancelled_at := coalesce(new.cancelled_at,now());
  end if;

  if old.status='pending' and new.status='accepted' then
    new.agreed_hourly_rate := old.offered_hourly_rate;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.notify_booking_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  target uuid;
  t text;
  b text;
  target_link text;
begin
  if tg_op='INSERT' then
    target := new.companion_id;
    t := 'New booking request';
    b := coalesce(new.customer_display_name,'Someone') || ' sent you a companionship request'
         || case when new.offered_hourly_rate is not null then ' with an offer of ₹' || new.offered_hourly_rate::text || '/hour.' else '.' end;
    target_link := 'requests.html?id=' || new.id::text;
  elsif new.status is distinct from old.status then
    if old.status='completed' and new.status='accepted' then return new; elsif new.status='accepted' then
      target := new.customer_id;
      t := 'Request accepted';
      b := coalesce(new.companion_display_name,'Your companion') || ' accepted your request'
           || case when new.agreed_hourly_rate is not null then ' at ₹' || new.agreed_hourly_rate::text || '/hour.' else '.' end
           || ' Chat is now open to coordinate the plan.';
      target_link := 'chat.html?booking=' || new.id::text;
    elsif new.status='declined' then
      target := new.customer_id;
      t := 'Request declined';
      b := coalesce(new.companion_display_name,'Your companion') || ' declined your request.';
      target_link := 'bookings.html?id=' || new.id::text;
    elsif new.status='cancelled' then
      target := case when auth.uid()=new.customer_id then new.companion_id else new.customer_id end;
      t := 'Booking cancelled';
      b := 'A companionship request was cancelled.';
      target_link := 'bookings.html?id=' || new.id::text;
    elsif new.status='completed' then
      target := new.customer_id;
      t := 'Booking completed';
      b := coalesce(new.companion_display_name,'Your companion') || ' marked the booking completed. You can leave a review.';
      target_link := 'bookings.html?id=' || new.id::text;
    else
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.notifications(user_id,kind,title,body,link)
  values(target,'booking',t,b,target_link);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.confirm_booking_completion(p_booking_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); result text;
begin
 if uid is null then raise exception 'Sign in to complete booking';end if;
 update public.booking_requests set status='completed'
 where id=p_booking_id and companion_id=uid and status='accepted'
 returning status into result;
 if found then return result;end if;
 select status into result from public.booking_requests where id=p_booking_id and companion_id=uid and status='completed';
 if found then return result;end if;
 raise exception 'Only the booked companion can complete an accepted booking' using errcode='42501';
end $function$;

revoke all on function public.confirm_booking_completion(uuid) from public,anon;
grant execute on function public.confirm_booking_completion(uuid) to authenticated;
