-- Ratings reflect reviews tied to currently completed bookings.
-- Reopening a plan removes its rating from aggregate temporarily,
-- without deleting the customer's one-time review.
create or replace function private.refresh_companion_rating()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare cid uuid;pid uuid;
begin
 cid:=coalesce(new.companion_id,old.companion_id);
 select l.public_id into pid from public.companion_listings l where l.user_id=cid;
 if pid is null then return coalesce(new,old); end if;
 insert into public.companion_rating_public(public_id,review_count,average_rating,updated_at)
 select pid,count(r.id)::bigint,round(avg(r.rating)::numeric,1),now()
 from public.booking_reviews r
 join public.booking_requests b on b.id=r.booking_id
 where r.companion_id=cid and b.status='completed'
 on conflict(public_id) do update
 set review_count=excluded.review_count,
 average_rating=excluded.average_rating,updated_at=excluded.updated_at;
 return coalesce(new,old);
end;
$$;
drop trigger if exists refresh_companion_rating_after_booking_status on public.booking_requests;
create trigger refresh_companion_rating_after_booking_status
after update of status on public.booking_requests for each row
when(old.status is distinct from new.status)
execute function private.refresh_companion_rating();