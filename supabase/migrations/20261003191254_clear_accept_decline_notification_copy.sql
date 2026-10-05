create or replace function private.notify_booking_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target uuid;
  t text;
  b text;
  target_link text;
begin
  if tg_op='INSERT' then
    target := new.companion_id;
    t := 'New booking request';
    b := coalesce(new.customer_display_name,'Someone') || ' sent you a new companionship request.';
    target_link := 'requests.html?id=' || new.id::text;
  elsif new.status is distinct from old.status then
    if new.status='accepted' then
      target := new.customer_id;
      t := 'Request accepted';
      b := coalesce(new.companion_display_name,'Your companion') || ' accepted your request. Chat and photo sharing are now open.';
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
$$;
revoke all on function private.notify_booking_change() from public,anon,authenticated;
