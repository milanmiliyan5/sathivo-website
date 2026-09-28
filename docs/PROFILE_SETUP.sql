create table public.profile_locations (
 id integer primary key, state text not null, district text not null, city text not null,
 unique(state,district,city)
);
alter table public.profile_locations enable row level security;
revoke all on public.profile_locations from anon, authenticated;
grant select on public.profile_locations to authenticated;
create policy locations_read on public.profile_locations for select to authenticated using(true);
insert into public.profile_locations(id,state,district,city) values
(1,'Andhra Pradesh','Visakhapatnam','Visakhapatnam'),
(2,'Arunachal Pradesh','Itanagar Capital Region','Itanagar'),
(3,'Assam','Kamrup Metropolitan','Guwahati'),
(4,'Bihar','Patna','Patna'),
(5,'Chhattisgarh','Raipur','Raipur'),
(6,'Goa','North Goa','Panaji'),
(7,'Gujarat','Ahmedabad','Ahmedabad'),
(8,'Haryana','Gurugram','Gurugram'),
(9,'Himachal Pradesh','Shimla','Shimla'),
(10,'Jharkhand','Ranchi','Ranchi'),
(11,'Karnataka','Bengaluru Urban','Bengaluru'),
(12,'Kerala','Ernakulam','Kochi'),
(13,'Madhya Pradesh','Indore','Indore'),
(14,'Maharashtra','Pune','Pune'),
(15,'Manipur','Imphal West','Imphal'),
(16,'Meghalaya','East Khasi Hills','Shillong'),
(17,'Mizoram','Aizawl','Aizawl'),
(18,'Nagaland','Kohima','Kohima'),
(19,'Odisha','Ganjam','Berhampur'),
(20,'Odisha','Ganjam','Bhanjanagar'),
(21,'Odisha','Ganjam','Chhatrapur'),
(22,'Odisha','Khordha','Bhubaneswar'),
(23,'Odisha','Cuttack','Cuttack'),
(24,'Odisha','Puri','Puri'),
(25,'Punjab','Ludhiana','Ludhiana'),
(26,'Rajasthan','Jaipur','Jaipur'),
(27,'Sikkim','Gangtok','Gangtok'),
(28,'Tamil Nadu','Chennai','Chennai'),
(29,'Telangana','Hyderabad','Hyderabad'),
(30,'Tripura','West Tripura','Agartala'),
(31,'Uttar Pradesh','Lucknow','Lucknow'),
(32,'Uttarakhand','Dehradun','Dehradun'),
(33,'West Bengal','Kolkata','Kolkata'),
(34,'Andaman and Nicobar Islands','South Andaman','Sri Vijaya Puram'),
(35,'Chandigarh','Chandigarh','Chandigarh'),
(36,'Dadra and Nagar Haveli and Daman and Diu','Daman','Daman'),
(37,'Delhi','New Delhi','New Delhi'),
(38,'Jammu and Kashmir','Srinagar','Srinagar'),
(39,'Jammu and Kashmir','Jammu','Jammu'),
(40,'Ladakh','Leh','Leh'),
(41,'Lakshadweep','Lakshadweep','Kavaratti'),
(42,'Puducherry','Puducherry','Puducherry');
create table public.member_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(trim(display_name)) between 2 and 60),
 profile_kind text not null check(profile_kind in ('customer','companion','both')),
 bio text not null default '' check(char_length(bio)<=600),
 location_id integer not null references public.profile_locations(id),
 languages text not null check(char_length(trim(languages)) between 2 and 160),
 interests text not null default '' check(char_length(interests)<=200),
 categories text[] not null default '{}' check(categories <@ array['Conversation','Coffee','Movies','Shopping','Events','Walking','Online chat','Phone conversation']::text[]),
 meeting_mode text not null check(meeting_mode in ('online','in-person','both')),
 availability text not null default '' check(char_length(availability)<=200),
 adult_confirmed boolean not null check(adult_confirmed),
 boundaries_accepted boolean not null check(boundaries_accepted),
 avatar_path text check(avatar_path is null or avatar_path = user_id::text || '/avatar.webp')
);
alter table public.member_profiles enable row level security;
revoke all on public.member_profiles from anon, authenticated;
grant select,insert,update on public.member_profiles to authenticated;
create policy profile_read_own on public.member_profiles for select to authenticated using((select auth.uid())=user_id);
create policy profile_insert_own on public.member_profiles for insert to authenticated with check((select auth.uid())=user_id);
create policy profile_update_own on public.member_profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-photos','profile-photos',false,2097152,array['image/webp']);
create policy profile_photo_read on storage.objects for select to authenticated using(bucket_id='profile-photos' and name=(select auth.uid())::text || '/avatar.webp');
create policy profile_photo_insert on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and name=(select auth.uid())::text || '/avatar.webp');
create policy profile_photo_update on storage.objects for update to authenticated using(bucket_id='profile-photos' and name=(select auth.uid())::text || '/avatar.webp') with check(bucket_id='profile-photos' and name=(select auth.uid())::text || '/avatar.webp');
