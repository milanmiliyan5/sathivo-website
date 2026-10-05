drop function if exists public.get_companion_rating(uuid);

create table if not exists public.companion_rating_public (
  public_id uuid primary key,
  review_count bigint not null default 0 check (review_count >= 0),
  average_rating numeric(2,1) check (average_rating is null or (average_rating between 1 and 5)),
  updated_at timestamptz not null default now()
);
alter table public.companion_rating_public enable row level security;
revoke all on public.companion_rating_public from anon, authenticated;
grant select on public.companion_rating_public to anon, authenticated;
drop policy if exists companion_rating_public_read on public.companion_rating_public;
create policy companion_rating_public_read on public.companion_rating_public
for select to anon, authenticated using (true);

create or replace function private.refresh_companion_rating()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  pid uuid;
  cid uuid;
begin
  cid := coalesce(new.companion_id, old.companion_id);
  select public_id into pid from public.companion_listings where user_id = cid;
  if pid is null then return coalesce(new,old); end if;

  insert into public.companion_rating_public(public_id,review_count,average_rating,updated_at)
  select pid, count(r.id)::bigint, round(avg(r.rating)::numeric,1), now()
  from public.booking_reviews r
  where r.companion_id = cid
  on conflict (public_id) do update
  set review_count=excluded.review_count,average_rating=excluded.average_rating,updated_at=excluded.updated_at;
  return coalesce(new,old);
end;
$$;
revoke all on function private.refresh_companion_rating() from public, anon, authenticated;
drop trigger if exists refresh_companion_rating_after_review on public.booking_reviews;
create trigger refresh_companion_rating_after_review
after insert or update or delete on public.booking_reviews
for each row execute function private.refresh_companion_rating();

create or replace function private.guard_listing_moderation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  is_admin boolean;
begin
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid()) into is_admin;
  if tg_op = 'INSERT' then
    if not is_admin then
      new.moderation_status := 'active';
      new.moderation_note := null;
    end if;
  else
    if new.user_id is distinct from old.user_id or new.public_id is distinct from old.public_id then
      raise exception 'Listing identity fields are immutable';
    end if;
    if not is_admin and (
      new.moderation_status is distinct from old.moderation_status
      or new.moderation_note is distinct from old.moderation_note
    ) then
      raise exception 'Only a Sathivo moderator can change moderation fields';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_listing_moderation() from public, anon, authenticated;
