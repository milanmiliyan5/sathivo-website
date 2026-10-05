insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'booking-chat-photos',
  'booking-chat-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

alter table public.booking_messages
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text','image')),
  add column if not exists photo_path text
    check (photo_path is null or char_length(photo_path) <= 500);

alter table public.booking_messages alter column body set default '';
alter table public.booking_messages drop constraint if exists booking_messages_body_check;
alter table public.booking_messages drop constraint if exists booking_messages_content_check;
alter table public.booking_messages
  add constraint booking_messages_content_check check (
    (
      message_type='text'
      and char_length(trim(body)) between 1 and 2000
      and photo_path is null
    )
    or
    (
      message_type='image'
      and char_length(body) <= 200
      and photo_path is not null
    )
  );

drop policy if exists messages_create_participants on public.booking_messages;
create policy messages_create_participants on public.booking_messages
for insert to authenticated
with check (
  (select auth.uid()) = sender_id
  and exists (
    select 1
    from public.booking_requests b
    where b.id = booking_id
      and (select auth.uid()) in (b.customer_id,b.companion_id)
      and b.status = 'accepted'
      and not exists (
        select 1
        from public.user_blocks ub
        where (ub.blocker_id=b.customer_id and ub.blocked_id=b.companion_id)
           or (ub.blocker_id=b.companion_id and ub.blocked_id=b.customer_id)
      )
  )
);

drop policy if exists booking_chat_photo_read on storage.objects;
create policy booking_chat_photo_read on storage.objects
for select to authenticated
using (
  bucket_id='booking-chat-photos'
  and exists (
    select 1
    from public.booking_requests b
    where b.id::text = (storage.foldername(name))[1]
      and (select auth.uid()) in (b.customer_id,b.companion_id)
  )
);

drop policy if exists booking_chat_photo_insert on storage.objects;
create policy booking_chat_photo_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='booking-chat-photos'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.booking_requests b
    where b.id::text = (storage.foldername(name))[1]
      and b.status='accepted'
      and (select auth.uid()) in (b.customer_id,b.companion_id)
  )
);

drop policy if exists booking_chat_photo_delete on storage.objects;
create policy booking_chat_photo_delete on storage.objects
for delete to authenticated
using (
  bucket_id='booking-chat-photos'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.booking_requests b
    where b.id::text = (storage.foldername(name))[1]
      and (select auth.uid()) in (b.customer_id,b.companion_id)
  )
);

create or replace function private.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  customer uuid;
  companion uuid;
  target uuid;
  message_body text;
begin
  select b.customer_id,b.companion_id
    into customer,companion
  from public.booking_requests b
  where b.id=new.booking_id;

  target := case when new.sender_id=customer then companion else customer end;
  message_body := case when new.message_type='image'
    then 'You received a photo in an accepted Sathivo booking.'
    else 'You have a new Sathivo booking message.'
  end;

  insert into public.notifications(user_id,kind,title,body,link)
  values (
    target,
    'message',
    case when new.message_type='image' then 'New photo' else 'New message' end,
    message_body,
    'chat.html?booking=' || new.booking_id::text
  );
  return new;
end;
$$;
revoke all on function private.notify_new_message() from public,anon,authenticated;

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
      target:=new.customer_id; t:='Request accepted'; b:='Your companion accepted the request. Chat is now open.'; target_link:='chat.html?booking='||new.id::text;
    elsif new.status='declined' then
      target:=new.customer_id; t:='Request declined'; b:='Your companion declined the request.'; target_link:='bookings.html?id='||new.id::text;
    elsif new.status='cancelled' then
      target:=case when auth.uid()=new.customer_id then new.companion_id else new.customer_id end;
      t:='Booking cancelled'; b:='A companionship request was cancelled.'; target_link:='bookings.html?id='||new.id::text;
    elsif new.status='completed' then
      target:=new.customer_id; t:='Booking completed'; b:='Your companion marked the booking completed. You can leave a review.'; target_link:='bookings.html?id='||new.id::text;
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
