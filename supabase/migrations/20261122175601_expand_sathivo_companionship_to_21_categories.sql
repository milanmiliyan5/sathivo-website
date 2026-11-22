-- Sathivo 21 experiences across five UI groups; preserve all original 8 values.
-- Additive constraint replacement only. Existing user profiles, listings,
-- bookings, chat messages, offers and other user data are not rewritten.
-- Do NOT rename legacy values Online chat / Phone conversation.
begin;
alter table public.member_profiles
  drop constraint if exists member_profiles_categories_check;
alter table public.member_profiles
  add constraint member_profiles_categories_check
  check (categories <@ ARRAY['Conversation'::text, 'Coffee'::text, 'Movies'::text, 'Shopping'::text, 'Events'::text, 'Walking'::text, 'Online chat'::text, 'Phone conversation'::text, 'City Exploration'::text, 'College Projects Help'::text, 'Study Partner'::text, 'Language Practice'::text, 'Interview Practice'::text, 'Digital Help'::text, 'New City Buddy'::text, 'Hospital Visit Companion'::text, 'Appointment Companion'::text, 'Senior Social Companion'::text, 'Sports & Fitness Partner'::text, 'Gaming Partner'::text, 'Photography & Creative Partner'::text]);

alter table public.companion_listings
  drop constraint if exists companion_listings_categories_check;
alter table public.companion_listings
  add constraint companion_listings_categories_check
  check (cardinality(categories)>0 and categories <@ ARRAY['Conversation'::text, 'Coffee'::text, 'Movies'::text, 'Shopping'::text, 'Events'::text, 'Walking'::text, 'Online chat'::text, 'Phone conversation'::text, 'City Exploration'::text, 'College Projects Help'::text, 'Study Partner'::text, 'Language Practice'::text, 'Interview Practice'::text, 'Digital Help'::text, 'New City Buddy'::text, 'Hospital Visit Companion'::text, 'Appointment Companion'::text, 'Senior Social Companion'::text, 'Sports & Fitness Partner'::text, 'Gaming Partner'::text, 'Photography & Creative Partner'::text]);

alter table public.booking_requests
  drop constraint if exists booking_requests_category_check;
alter table public.booking_requests
  add constraint booking_requests_category_check
  check (category=any(ARRAY['Conversation'::text, 'Coffee'::text, 'Movies'::text, 'Shopping'::text, 'Events'::text, 'Walking'::text, 'Online chat'::text, 'Phone conversation'::text, 'City Exploration'::text, 'College Projects Help'::text, 'Study Partner'::text, 'Language Practice'::text, 'Interview Practice'::text, 'Digital Help'::text, 'New City Buddy'::text, 'Hospital Visit Companion'::text, 'Appointment Companion'::text, 'Senior Social Companion'::text, 'Sports & Fitness Partner'::text, 'Gaming Partner'::text, 'Photography & Creative Partner'::text]));
commit;
