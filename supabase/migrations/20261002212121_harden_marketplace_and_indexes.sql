revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists booking_messages_sender_idx on public.booking_messages(sender_id);
create index if not exists booking_requests_public_listing_idx on public.booking_requests(companion_public_id);
create index if not exists booking_reviews_reviewer_idx on public.booking_reviews(reviewer_id);
create index if not exists member_profiles_location_idx on public.member_profiles(location_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);
create index if not exists user_reports_booking_idx on public.user_reports(booking_id);
create index if not exists user_reports_reporter_idx on public.user_reports(reporter_id);
