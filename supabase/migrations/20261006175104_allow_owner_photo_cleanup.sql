drop policy if exists profile_photo_delete on storage.objects;
create policy profile_photo_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and name = ((select auth.uid())::text || '/avatar.webp')
);

drop policy if exists listing_photo_delete on storage.objects;
create policy listing_photo_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'listing-photos'
  and name = ((select auth.uid())::text || '/avatar.webp')
);
