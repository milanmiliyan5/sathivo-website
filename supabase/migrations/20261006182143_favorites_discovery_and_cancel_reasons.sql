-- Sathivo discovery, favorites and cancellation details.

create table if not exists public.companion_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  companion_public_id uuid not null references public.companion_listings(public_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, companion_public_id)
);
alter table public.companion_favorites enable row level security;
revoke all on public.companion_favorites from public, anon;
grant select, insert, delete on public.companion_favorites to authenticated;

drop policy if exists companion_favorites_read_own on public.companion_favorites;
create policy companion_favorites_read_own on public.companion_favorites
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists companion_favorites_add_own on public.companion_favorites;
create policy companion_favorites_add_own on public.companion_favorites
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.companion_listings l
    where l.public_id = companion_public_id
      and l.published
      and l.moderation_status = 'active'
  )
);

drop policy if exists companion_favorites_delete_own on public.companion_favorites;
create policy companion_favorites_delete_own on public.companion_favorites
for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists companion_favorites_public_id_idx
on public.companion_favorites(companion_public_id);

alter table public.booking_requests
  add column if not exists cancel_reason text,
  add column if not exists cancel_note text,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_at timestamptz;

alter table public.booking_requests
  drop constraint if exists booking_requests_cancel_reason_check;
alter table public.booking_requests
  add constraint booking_requests_cancel_reason_check
  check (
    cancel_reason is null
    or cancel_reason in ('plan_changed','time_issue','safety_concern','other')
  );

alter table public.booking_requests
  drop constraint if exists booking_requests_cancel_note_check;
alter table public.booking_requests
  add constraint booking_requests_cancel_note_check
  check (cancel_note is null or char_length(cancel_note) <= 300);

create or replace function private.enforce_booking_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
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

  if not is_admin then
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
$$;
revoke all on function private.enforce_booking_transition() from public, anon, authenticated;

create or replace function public.browse_public_companions(
  p_location_ids integer[] default null,
  p_category text default null,
  p_mode text default null,
  p_sort text default 'newest',
  p_public_ids uuid[] default null,
  p_offset integer default 0,
  p_limit integer default 25
)
returns table (
  public_id uuid,
  display_name text,
  bio text,
  location_id integer,
  languages text,
  interests text,
  categories text[],
  meeting_mode text,
  availability text,
  hourly_rate integer,
  photo_path text,
  safety_id text,
  joined_at timestamptz,
  email_verified_at timestamptz,
  adult_confirmed boolean,
  boundaries_accepted boolean,
  review_count bigint,
  average_rating numeric
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    l.public_id,
    l.display_name,
    l.bio,
    l.location_id,
    l.languages,
    l.interests,
    l.categories,
    l.meeting_mode,
    l.availability,
    l.hourly_rate,
    l.photo_path,
    l.safety_id,
    l.joined_at,
    l.email_verified_at,
    l.adult_confirmed,
    l.boundaries_accepted,
    coalesce(r.review_count,0)::bigint,
    r.average_rating
  from public.companion_listings l
  left join public.companion_rating_public r on r.public_id=l.public_id
  where l.published
    and l.moderation_status='active'
    and (p_location_ids is null or l.location_id = any(p_location_ids))
    and (p_category is null or p_category = any(l.categories))
    and (p_mode is null or l.meeting_mode in (p_mode,'both'))
    and (p_public_ids is null or l.public_id = any(p_public_ids))
  order by
    case when p_sort='price_asc' then l.hourly_rate end asc nulls last,
    case when p_sort='price_desc' then l.hourly_rate end desc nulls last,
    case when p_sort='rating' then coalesce(r.average_rating,0) end desc nulls last,
    case when p_sort='rating' then coalesce(r.review_count,0) end desc,
    case when p_sort='newest' then l.joined_at end desc nulls last,
    l.public_id
  offset greatest(coalesce(p_offset,0),0)
  limit least(greatest(coalesce(p_limit,25),1),100);
$$;

revoke all on function public.browse_public_companions(integer[],text,text,text,uuid[],integer,integer) from public;
grant execute on function public.browse_public_companions(integer[],text,text,text,uuid[],integer,integer) to anon, authenticated;
