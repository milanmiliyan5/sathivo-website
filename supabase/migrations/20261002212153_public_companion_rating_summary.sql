create or replace function public.get_companion_rating(p_public_id uuid)
returns table(review_count bigint, average_rating numeric)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(r.id)::bigint, round(avg(r.rating)::numeric, 1)
  from public.companion_listings l
  left join public.booking_reviews r on r.companion_id = l.user_id
  where l.public_id = p_public_id
    and l.published
    and l.moderation_status = 'active'
$$;
revoke all on function public.get_companion_rating(uuid) from public;
grant execute on function public.get_companion_rating(uuid) to anon, authenticated;
