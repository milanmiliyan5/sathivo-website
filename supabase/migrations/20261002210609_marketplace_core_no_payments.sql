create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.companion_listings
  add column if not exists moderation_status text not null default 'active'
    check (moderation_status in ('active','suspended')),
  add column if not exists moderation_note text
    check (moderation_note is null or char_length(moderation_note) <= 500);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'moderator' check (role in ('owner','moderator')),
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;
drop policy if exists platform_admins_read_self on public.platform_admins;
create policy platform_admins_read_self on public.platform_admins
for select to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
drop policy if exists blocks_read_involving_me on public.user_blocks;
create policy blocks_read_involving_me on public.user_blocks
for select to authenticated
using ((select auth.uid()) in (blocker_id, blocked_id));
drop policy if exists blocks_create_own on public.user_blocks;
create policy blocks_create_own on public.user_blocks
for insert to authenticated
with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_id);
drop policy if exists blocks_delete_own on public.user_blocks;
create policy blocks_delete_own on public.user_blocks
for delete to authenticated
using ((select auth.uid()) = blocker_id);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  companion_id uuid not null references auth.users(id) on delete cascade,
  companion_public_id uuid not null references public.companion_listings(public_id) on update cascade on delete restrict,
  category text not null check (category = any(array[
    'Conversation','Coffee','Movies','Shopping','Events','Walking','Online chat','Phone conversation'
  ]::text[])),
  meeting_mode text not null check (meeting_mode in ('online','in-person')),
  requested_for timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 30 and 480),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id <> companion_id)
);
create index if not exists booking_requests_customer_idx on public.booking_requests(customer_id, created_at desc);
create index if not exists booking_requests_companion_idx on public.booking_requests(companion_id, created_at desc);
create index if not exists booking_requests_status_idx on public.booking_requests(status, requested_for);
alter table public.booking_requests enable row level security;
revoke all on public.booking_requests from anon, authenticated;
grant select, insert, update on public.booking_requests to authenticated;

create table if not exists public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists booking_messages_booking_idx on public.booking_messages(booking_id, created_at);
alter table public.booking_messages enable row level security;
revoke all on public.booking_messages from anon, authenticated;
grant select, insert on public.booking_messages to authenticated;

create table if not exists public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.booking_requests(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  companion_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 600),
  created_at timestamptz not null default now()
);
create index if not exists booking_reviews_companion_idx on public.booking_reviews(companion_id, created_at desc);
alter table public.booking_reviews enable row level security;
revoke all on public.booking_reviews from anon, authenticated;
grant select, insert on public.booking_reviews to authenticated;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.booking_requests(id) on delete set null,
  reason text not null check (reason in ('safety','harassment','sexual-content','scam','fake-profile','spam','other')),
  details text not null default '' check (char_length(details) between 0 and 1500),
  status text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create index if not exists user_reports_status_idx on public.user_reports(status, created_at desc);
create index if not exists user_reports_reported_idx on public.user_reports(reported_user_id, created_at desc);
alter table public.user_reports enable row level security;
revoke all on public.user_reports from anon, authenticated;
grant select, insert, update on public.user_reports to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('booking','message','safety','system')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 500),
  link text check (link is null or char_length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;

drop policy if exists listings_public_read on public.companion_listings;
create policy listings_public_read on public.companion_listings
for select to anon, authenticated
using (published and moderation_status = 'active');

drop policy if exists listings_admin_read on public.companion_listings;
create policy listings_admin_read on public.companion_listings
for select to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

drop policy if exists listings_admin_update on public.companion_listings;
create policy listings_admin_update on public.companion_listings
for update to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

drop policy if exists bookings_read_participants on public.booking_requests;
create policy bookings_read_participants on public.booking_requests
for select to authenticated
using (
  (select auth.uid()) in (customer_id, companion_id)
  or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
);

drop policy if exists bookings_create_customer on public.booking_requests;
create policy bookings_create_customer on public.booking_requests
for insert to authenticated
with check (
  (select auth.uid()) = customer_id
  and status = 'pending'
  and requested_for > now()
  and exists (
    select 1 from public.companion_listings l
    where l.public_id = companion_public_id
      and l.user_id = companion_id
      and l.published
      and l.moderation_status = 'active'
  )
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = customer_id and b.blocked_id = companion_id)
       or (b.blocker_id = companion_id and b.blocked_id = customer_id)
  )
);

drop policy if exists bookings_update_participants on public.booking_requests;
create policy bookings_update_participants on public.booking_requests
for update to authenticated
using (
  (select auth.uid()) in (customer_id, companion_id)
  or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
)
with check (
  (select auth.uid()) in (customer_id, companion_id)
  or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
);

drop policy if exists messages_read_participants on public.booking_messages;
create policy messages_read_participants on public.booking_messages
for select to authenticated
using (
  exists (
    select 1 from public.booking_requests b
    where b.id = booking_id
      and ((select auth.uid()) in (b.customer_id, b.companion_id)
        or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
  )
);

drop policy if exists messages_create_participants on public.booking_messages;
create policy messages_create_participants on public.booking_messages
for insert to authenticated
with check (
  (select auth.uid()) = sender_id
  and exists (
    select 1 from public.booking_requests b
    where b.id = booking_id
      and (select auth.uid()) in (b.customer_id, b.companion_id)
      and b.status in ('pending','accepted')
      and not exists (
        select 1 from public.user_blocks ub
        where (ub.blocker_id = b.customer_id and ub.blocked_id = b.companion_id)
           or (ub.blocker_id = b.companion_id and ub.blocked_id = b.customer_id)
      )
  )
);

drop policy if exists reviews_read_participants on public.booking_reviews;
create policy reviews_read_participants on public.booking_reviews
for select to authenticated
using (
  (select auth.uid()) in (reviewer_id, companion_id)
  or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
);

drop policy if exists reviews_create_customer on public.booking_reviews;
create policy reviews_create_customer on public.booking_reviews
for insert to authenticated
with check (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1 from public.booking_requests b
    where b.id = booking_id
      and b.status = 'completed'
      and b.customer_id = reviewer_id
      and b.companion_id = companion_id
  )
);

drop policy if exists reports_read_own_or_admin on public.user_reports;
create policy reports_read_own_or_admin on public.user_reports
for select to authenticated
using (
  (select auth.uid()) = reporter_id
  or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
);

drop policy if exists reports_create_own on public.user_reports;
create policy reports_create_own on public.user_reports
for insert to authenticated
with check (
  (select auth.uid()) = reporter_id
  and reporter_id <> reported_user_id
  and (
    exists (
      select 1 from public.booking_requests b
      where b.id = booking_id
        and reporter_id in (b.customer_id, b.companion_id)
        and reported_user_id in (b.customer_id, b.companion_id)
    )
    or (
      booking_id is null
      and exists (
        select 1 from public.companion_listings l
        where l.user_id = reported_user_id and l.published
      )
    )
  )
);

drop policy if exists reports_admin_update on public.user_reports;
create policy reports_admin_update on public.user_reports
for update to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function private.guard_listing_moderation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1 from public.platform_admins a where a.user_id = auth.uid()
  ) into is_admin;

  if tg_op = 'INSERT' then
    if not is_admin then
      new.moderation_status := 'active';
      new.moderation_note := null;
    end if;
  elsif not is_admin and (
    new.moderation_status is distinct from old.moderation_status
    or new.moderation_note is distinct from old.moderation_note
  ) then
    raise exception 'Only a Sathivo moderator can change moderation fields';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_listing_moderation() from public, anon, authenticated;
drop trigger if exists companion_listing_moderation_guard on public.companion_listings;
create trigger companion_listing_moderation_guard
before insert or update on public.companion_listings
for each row execute function private.guard_listing_moderation();

create or replace function private.enforce_booking_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  is_admin boolean;
begin
  select exists (
    select 1 from public.platform_admins a where a.user_id = uid
  ) into is_admin;

  if new.customer_id is distinct from old.customer_id
     or new.companion_id is distinct from old.companion_id
     or new.companion_public_id is distinct from old.companion_public_id
     or new.category is distinct from old.category
     or new.meeting_mode is distinct from old.meeting_mode
     or new.requested_for is distinct from old.requested_for
     or new.duration_minutes is distinct from old.duration_minutes
     or new.note is distinct from old.note
     or new.created_at is distinct from old.created_at then
    raise exception 'Booking details cannot be changed after the request is sent';
  end if;

  if not is_admin then
    if uid = old.customer_id then
      if not (old.status in ('pending','accepted') and new.status = 'cancelled') then
        raise exception 'Customers can only cancel pending or accepted requests';
      end if;
    elsif uid = old.companion_id then
      if not (
        (old.status = 'pending' and new.status in ('accepted','declined'))
        or (old.status = 'accepted' and new.status = 'completed')
      ) then
        raise exception 'This booking status change is not allowed';
      end if;
    else
      raise exception 'Not allowed to change this booking';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.enforce_booking_transition() from public, anon, authenticated;
drop trigger if exists booking_transition_guard on public.booking_requests;
create trigger booking_transition_guard
before update on public.booking_requests
for each row execute function private.enforce_booking_transition();

create or replace function private.touch_report_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_report_updated_at() from public, anon, authenticated;
drop trigger if exists user_reports_touch_updated_at on public.user_reports;
create trigger user_reports_touch_updated_at
before update on public.user_reports
for each row execute function private.touch_report_updated_at();

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
begin
  if tg_op = 'INSERT' then
    target := new.companion_id;
    t := 'New booking request';
    b := 'Someone sent you a new companionship request.';
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      target := new.customer_id; t := 'Request accepted'; b := 'Your companion accepted the request.';
    elsif new.status = 'declined' then
      target := new.customer_id; t := 'Request declined'; b := 'Your companion declined the request.';
    elsif new.status = 'cancelled' then
      target := case when auth.uid() = new.customer_id then new.companion_id else new.customer_id end;
      t := 'Booking cancelled'; b := 'A companionship request was cancelled.';
    elsif new.status = 'completed' then
      target := new.customer_id; t := 'Booking completed'; b := 'Your companion marked the booking completed. You can leave a review.';
    else
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.notifications(user_id, kind, title, body, link)
  values (target, 'booking', t, b, 'bookings.html?id=' || new.id::text);
  return new;
end;
$$;
revoke all on function private.notify_booking_change() from public, anon, authenticated;
drop trigger if exists booking_notification_trigger on public.booking_requests;
create trigger booking_notification_trigger
after insert or update of status on public.booking_requests
for each row execute function private.notify_booking_change();

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
begin
  select b.customer_id, b.companion_id into customer, companion
  from public.booking_requests b where b.id = new.booking_id;

  target := case when new.sender_id = customer then companion else customer end;
  insert into public.notifications(user_id, kind, title, body, link)
  values (target, 'message', 'New message', 'You have a new Sathivo booking message.', 'chat.html?booking=' || new.booking_id::text);
  return new;
end;
$$;
revoke all on function private.notify_new_message() from public, anon, authenticated;
drop trigger if exists message_notification_trigger on public.booking_messages;
create trigger message_notification_trigger
after insert on public.booking_messages
for each row execute function private.notify_new_message();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='booking_requests'
  ) then
    alter publication supabase_realtime add table public.booking_requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='booking_messages'
  ) then
    alter publication supabase_realtime add table public.booking_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
