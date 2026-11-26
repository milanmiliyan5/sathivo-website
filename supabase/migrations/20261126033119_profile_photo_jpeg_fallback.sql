-- Allow compressed JPEG fallback on browsers without WebP canvas encoding.
-- Keep both buckets private, existing owner-only object policies and 2 MiB limits unchanged.
update storage.buckets
set allowed_mime_types = array['image/webp','image/jpeg']::text[]
where id in ('profile-photos','listing-photos');
