CREATE OR REPLACE FUNCTION public.browse_public_companions_v3(p_location_ids integer[] DEFAULT NULL::integer[], p_city text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_mode text DEFAULT NULL::text, p_sort text DEFAULT 'newest'::text, p_public_ids uuid[] DEFAULT NULL::uuid[], p_offset integer DEFAULT 0, p_limit integer DEFAULT 25, p_gender text DEFAULT NULL::text)
 RETURNS TABLE(public_id uuid, display_name text, bio text, location_id integer, city_name text, languages text, interests text, categories text[], meeting_mode text, availability text, hourly_rate integer, photo_path text, safety_id text, joined_at timestamp with time zone, email_verified_at timestamp with time zone, adult_confirmed boolean, boundaries_accepted boolean, review_count bigint, average_rating numeric, public_gender text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  with eligible as (
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
    coalesce(r.review_count,0)::bigint as review_count,
    r.average_rating,
    l.public_gender
  from public.companion_listings l
  left join public.companion_rating_public r on r.public_id = l.public_id
  left join public.profile_locations pl on pl.id = l.location_id
  where l.published
    and l.moderation_status = 'active'
    and (p_location_ids is null or l.location_id = any(p_location_ids))
    -- A city search accepts exact names, partial typing and broader public
    -- districts/states where relevant, without exposing private profiles.
    -- Examples: "Delhi" finds "New Delhi" and "Delhi CP";
    -- "Bengaluru" and "Bangalore" are equivalent.
    and (
      p_city is null
      or nullif(btrim(p_city),'') is null
      or position(lower(btrim(p_city)) in lower(btrim(l.city_name))) > 0
      or position(lower(btrim(p_city)) in lower(btrim(pl.district))) > 0
      or lower(btrim(pl.state)) = lower(btrim(p_city))
      or (
        lower(btrim(p_city)) in ('bangalore','bengaluru')
        and (
          lower(btrim(l.city_name)) in ('bangalore','bengaluru')
          or lower(btrim(pl.district)) in
            ('bengaluru urban','bengaluru rural','bangalore urban','bangalore rural')
        )
      )
      or (
        lower(btrim(p_city)) in ('delhi','delhi ncr','nct of delhi')
        and lower(btrim(pl.state)) = 'delhi'
      )
    )
    and (p_gender is null or l.public_gender = p_gender)
    and (p_category is null or p_category = any(l.categories))
    and (p_mode is null or l.meeting_mode in (p_mode,'both'))
    and (p_public_ids is null or l.public_id = any(p_public_ids))
  ), keyed as (
    select e.*, md5(split_part(p_sort, ':', 2) || ':' || e.public_id::text) || ':' || e.public_id::text as shuffle_key
    from eligible e
  ), featured as (
    select case
      when split_part(p_sort, ':', 1) = 'discover-first' and length(split_part(p_sort, ':', 2)) = 16 and p_gender is null and p_public_ids is null and split_part(p_sort, ':', 3) <> '' and split_part(p_sort, ':', 4) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then md5(split_part(p_sort, ':', 2) || ':' || split_part(p_sort, ':', 4)) || ':' || split_part(p_sort, ':', 4)
      else min(k.shuffle_key) filter (where k.public_gender='female')
    end as first_key
    from keyed k
    where split_part(p_sort, ':', 1) = 'discover-first'
      and length(split_part(p_sort, ':', 2)) = 16
      and p_gender is null and p_public_ids is null
  ), ordered as (
    select k.*, case when k.shuffle_key=f.first_key then '0:' else '1:' end || k.shuffle_key as discover_key,
      case when f.first_key=md5(split_part(p_sort, ':', 2) || ':' || split_part(p_sort, ':', 3)) || ':' || split_part(p_sort, ':', 3) then '0:' else '1:' end ||
      md5(split_part(p_sort, ':', 2) || ':' || split_part(p_sort, ':', 3)) || ':' || split_part(p_sort, ':', 3) as cursor_key
    from keyed k cross join featured f
  )
  select o.public_id,o.display_name,o.bio,o.location_id,o.city_name,o.languages,o.interests,o.categories,o.meeting_mode,o.availability,o.hourly_rate,o.photo_path,o.safety_id,o.joined_at,o.email_verified_at,o.adult_confirmed,o.boundaries_accepted,o.review_count,o.average_rating,o.public_gender
  from ordered o
  where not coalesce(split_part(p_sort, ':', 1) in ('discover','discover-first') and length(split_part(p_sort, ':', 2))=16,false)
     or split_part(p_sort, ':', 3)='' or o.discover_key > o.cursor_key
  order by
    case when split_part(p_sort, ':', 1) in ('discover','discover-first') and length(split_part(p_sort, ':', 2))=16 then o.discover_key end asc nulls last,
    case when p_sort='price_asc' then o.hourly_rate end asc nulls last,
    case when p_sort='price_desc' then o.hourly_rate end desc nulls last,
    case when p_sort='rating' then coalesce(o.average_rating,0) end desc nulls last,
    case when p_sort='rating' then o.review_count end desc,
    case when p_sort='newest' then o.joined_at end desc nulls last,
    o.public_id
  offset greatest(coalesce(p_offset,0),0)
  limit least(greatest(coalesce(p_limit,25),1),100);
$function$;
