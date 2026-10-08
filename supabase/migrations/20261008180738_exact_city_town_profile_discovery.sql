alter table public.member_profiles
  add column if not exists city_name text;

alter table public.companion_listings
  add column if not exists city_name text;

update public.member_profiles p
set city_name = case when l.city = 'District-wide' then l.district else l.city end
from public.profile_locations l
where p.location_id = l.id
  and (p.city_name is null or btrim(p.city_name) = '');

update public.companion_listings c
set city_name = case when l.city = 'District-wide' then l.district else l.city end
from public.profile_locations l
where c.location_id = l.id
  and (c.city_name is null or btrim(c.city_name) = '');

create or replace function private.normalize_city_name_from_location()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  location_row record;
begin
  if new.city_name is null or btrim(new.city_name) = '' then
    select l.city, l.district
      into location_row
      from public.profile_locations l
      where l.id = new.location_id;

    if location_row.city is null then
      raise exception 'Selected location is unavailable';
    end if;

    new.city_name := case
      when location_row.city = 'District-wide' then location_row.district
      else location_row.city
    end;
  else
    new.city_name := btrim(new.city_name);
  end if;

  return new;
end;
$$;

drop trigger if exists member_profiles_normalize_city_name on public.member_profiles;
create trigger member_profiles_normalize_city_name
before insert or update of city_name, location_id on public.member_profiles
for each row execute function private.normalize_city_name_from_location();

drop trigger if exists companion_listings_normalize_city_name on public.companion_listings;
create trigger companion_listings_normalize_city_name
before insert or update of city_name, location_id on public.companion_listings
for each row execute function private.normalize_city_name_from_location();

alter table public.member_profiles
  alter column city_name set not null;

alter table public.companion_listings
  alter column city_name set not null;

alter table public.member_profiles
  add constraint member_profiles_city_name_check
  check (char_length(btrim(city_name)) between 2 and 80);

alter table public.companion_listings
  add constraint companion_listings_city_name_check
  check (char_length(btrim(city_name)) between 2 and 80);

create index if not exists listings_city_lower_published_idx
  on public.companion_listings (lower(btrim(city_name)))
  where published;

create or replace function public.browse_public_companions_v2(
  p_location_ids integer[] default null,
  p_city text default null,
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
  city_name text,
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
    l.city_name,
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
  left join public.companion_rating_public r on r.public_id = l.public_id
  where l.published
    and l.moderation_status = 'active'
    and (p_location_ids is null or l.location_id = any(p_location_ids))
    and (p_city is null or lower(btrim(l.city_name)) = lower(btrim(p_city)))
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

revoke all on function public.browse_public_companions_v2(integer[],text,text,text,text,uuid[],integer,integer) from public;
grant execute on function public.browse_public_companions_v2(integer[],text,text,text,text,uuid[],integer,integer) to anon, authenticated;

create or replace function public.browse_public_city_suggestions(
  p_location_ids integer[] default null
)
returns table (
  city_name text
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select min(l.city_name) as city_name
  from public.companion_listings l
  where l.published
    and l.moderation_status = 'active'
    and (p_location_ids is null or l.location_id = any(p_location_ids))
    and char_length(btrim(l.city_name)) between 2 and 80
  group by lower(btrim(l.city_name))
  order by min(l.city_name)
  limit 500;
$$;

revoke all on function public.browse_public_city_suggestions(integer[]) from public;
grant execute on function public.browse_public_city_suggestions(integer[]) to anon, authenticated;
