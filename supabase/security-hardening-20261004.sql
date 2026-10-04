-- Sathivo audit hardening applied to the live Supabase project on 2026-10-04.
-- Keep this file as the repository reference for the production changes.

-- A review must point to the actual companion on the completed booking.
drop policy if exists reviews_create_customer on public.booking_reviews;
create policy reviews_create_customer
on public.booking_reviews
for insert
to authenticated
with check (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1
    from public.booking_requests b
    where b.id = booking_reviews.booking_id
      and b.status = 'completed'
      and b.customer_id = booking_reviews.reviewer_id
      and b.companion_id = booking_reviews.companion_id
  )
);

-- A suspended companion's copied public photo must no longer be publicly readable.
drop policy if exists listing_photo_read on storage.objects;
create policy listing_photo_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'listing-photos'
  and (
    name = ((select auth.uid())::text || '/avatar.webp')
    or exists (
      select 1
      from public.companion_listings l
      where l.published
        and l.moderation_status = 'active'
        and l.photo_path = storage.objects.name
    )
  )
);

-- Cover the viewed_by foreign key used by view-once media.
create index if not exists booking_messages_viewed_by_idx
  on public.booking_messages(viewed_by);
