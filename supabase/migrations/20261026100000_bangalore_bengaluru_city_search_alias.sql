-- Search-only city alias correction for Sathivo's public companion directory.
-- Both Bangalore and Bengaluru match the same listings, and city suggestions
-- display the official Bengaluru name. Existing user/profile records are not
-- updated. Keep invoker security, published/active guards and RPC grants.
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
    -- Preserve exact matching for every city; also accept the established
    -- Bangalore/Bengaluru spellings as equivalent without editing saved profiles.
    and (
      p_city is null
      or lower(btrim(l.city_name)) = lower(btrim(p_city))
      or (
        lower(btrim(l.city_name)) in ('bangalore','bengaluru')
        and lower(btrim(p_city)) in ('bangalore','bengaluru')
      )
    )
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
  select
    case
      when min(lower(btrim(l.city_name))) in ('bangalore','bengaluru') then 'Bengaluru'
      else min(l.city_name)
    end as city_name
  from public.companion_listings l
  where l.published
    and l.moderation_status = 'active'
    and (p_location_ids is null or l.location_id = any(p_location_ids))
    and char_length(btrim(l.city_name)) between 2 and 80
  group by case
    when lower(btrim(l.city_name)) in ('bangalore','bengaluru') then 'bengaluru'
    else lower(btrim(l.city_name))
  end
  order by 1
  limit 500;
$$;

revoke all on function public.browse_public_city_suggestions(integer[]) from public;
grant execute on function public.browse_public_city_suggestions(integer[]) to anon, authenticated;
