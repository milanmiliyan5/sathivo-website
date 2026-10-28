-- Sathivo public companion discovery: partial city/district searches and aliases.
-- Shared by sathivo.co and the native Android app. Only published active listings.
-- Applied live on 2026-10-29; documented here for reproducible deployments.

CREATE OR REPLACE FUNCTION public.browse_public_companions_v2(p_location_ids integer[] DEFAULT NULL::integer[], p_city text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_mode text DEFAULT NULL::text, p_sort text DEFAULT 'newest'::text, p_public_ids uuid[] DEFAULT NULL::uuid[], p_offset integer DEFAULT 0, p_limit integer DEFAULT 25)
 RETURNS TABLE(public_id uuid, display_name text, bio text, location_id integer, city_name text, languages text, interests text, categories text[], meeting_mode text, availability text, hourly_rate integer, photo_path text, safety_id text, joined_at timestamp with time zone, email_verified_at timestamp with time zone, adult_confirmed boolean, boundaries_accepted boolean, review_count bigint, average_rating numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$
;
