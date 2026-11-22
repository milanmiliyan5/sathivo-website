-- Only published, active companions' aggregate completed booking totals are exposed.
-- No booking rows, identities, notes, prices, dates or participant data returned.
create or replace function public.public_companion_completed_counts(p_public_ids uuid[])
returns table(public_id uuid, completed_count bigint)
language sql stable security definer
set search_path = ''
as $$
  select l.public_id, count(b.id)::bigint as completed_count
  from public.companion_listings as l
  left join public.booking_requests as b
    on b.companion_id = l.user_id and b.status = 'completed'
  where l.published is true
    and l.moderation_status = 'active'
    and coalesce(cardinality(p_public_ids), 0) between 1 and 100
    and l.public_id = any(p_public_ids)
  group by l.public_id
  limit 100;
$$;
revoke all on function public.public_companion_completed_counts(uuid[]) from public;
grant execute on function public.public_companion_completed_counts(uuid[]) to anon, authenticated;
comment on function public.public_companion_completed_counts(uuid[]) is
 'Read-only published companion completed booking counts; returns zero for new companions, no private booking fields.';
