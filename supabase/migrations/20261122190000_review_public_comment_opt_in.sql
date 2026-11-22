alter table public.booking_reviews add column if not exists is_public_comment boolean not null default false;
comment on column public.booking_reviews.is_public_comment is 'Customer opt-in for anonymously published written reviews.';
create or replace function public.public_companion_review_comments(p_public_id uuid,p_limit integer default 15)
returns table(rating smallint,comment text,created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
 select r.rating,left(btrim(r.comment),600),r.created_at
 from public.companion_listings l
 join public.booking_reviews r on r.companion_id=l.user_id
 join public.booking_requests b on b.id=r.booking_id
 where l.public_id=p_public_id and l.published=true and l.moderation_status='active'
 and b.status='completed' and b.customer_id=r.reviewer_id
 and r.is_public_comment=true and btrim(r.comment)<>''
 order by r.created_at desc limit greatest(0,least(coalesce(p_limit,15),30));
$$;
revoke all on function public.public_companion_review_comments(uuid,integer) from public;
grant execute on function public.public_companion_review_comments(uuid,integer) to anon,authenticated;