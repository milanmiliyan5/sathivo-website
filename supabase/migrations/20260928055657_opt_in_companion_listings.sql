create table public.companion_listings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 public_id uuid not null unique default gen_random_uuid(),
 published boolean not null default false,
 display_name text not null check(char_length(trim(display_name)) between 2 and 60),
 bio text not null check(char_length(trim(bio)) between 20 and 600),
 location_id integer not null references public.profile_locations(id),
 languages text not null check(char_length(trim(languages)) between 2 and 160),
 interests text not null default '' check(char_length(interests)<=200),
 categories text[] not null check(cardinality(categories)>0 and categories <@ array['Conversation','Coffee','Movies','Shopping','Events','Walking','Online chat','Phone conversation']::text[]),
 meeting_mode text not null check(meeting_mode in ('online','in-person','both')),
 availability text not null default '' check(char_length(availability)<=200),
 photo_path text check(photo_path is null or photo_path = user_id::text || '/avatar.webp')
);
alter table public.companion_listings enable row level security;
revoke all on public.companion_listings from anon,authenticated;
grant select on public.companion_listings to anon,authenticated;
grant insert,update on public.companion_listings to authenticated;
create policy listings_public_read on public.companion_listings for select to anon,authenticated using(published);
create policy listings_owner_read on public.companion_listings for select to authenticated using((select auth.uid())=user_id);
create policy listings_owner_insert on public.companion_listings for insert to authenticated with check((select auth.uid())=user_id and exists(select 1 from public.member_profiles p where p.user_id=(select auth.uid()) and p.profile_kind in ('companion','both')));
create policy listings_owner_update on public.companion_listings for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and (not published or exists(select 1 from public.member_profiles p where p.user_id=(select auth.uid()) and p.profile_kind in ('companion','both'))));
grant select on public.profile_locations to anon;
create policy locations_public_read on public.profile_locations for select to anon using(true);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('listing-photos','listing-photos',false,2097152,array['image/webp']);
create policy listing_photo_read on storage.objects for select to anon,authenticated using(bucket_id='listing-photos' and (name=(select auth.uid())::text || '/avatar.webp' or exists(select 1 from public.companion_listings l where l.published and l.photo_path=name)));
create policy listing_photo_insert on storage.objects for insert to authenticated with check(bucket_id='listing-photos' and name=(select auth.uid())::text || '/avatar.webp');
create policy listing_photo_update on storage.objects for update to authenticated using(bucket_id='listing-photos' and name=(select auth.uid())::text || '/avatar.webp') with check(bucket_id='listing-photos' and name=(select auth.uid())::text || '/avatar.webp');
create index listings_location on public.companion_listings(location_id) where published;
