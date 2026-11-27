-- The saved companion rate is authoritative; never create or publish a listing here.
create function private.sathivo_sync_saved_hourly_rate() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.profile_kind in ('companion','both')
     and new.hourly_rate between 1 and 100000
     and (new.hourly_rate is distinct from old.hourly_rate or new.profile_kind is distinct from old.profile_kind) then
    update public.companion_listings l
      set hourly_rate=new.hourly_rate
      where l.user_id=new.user_id and l.published
        and l.hourly_rate is distinct from new.hourly_rate;
  end if;
  return new;
end $$;
revoke all on function private.sathivo_sync_saved_hourly_rate() from public,anon,authenticated;
create trigger sathivo_saved_hourly_rate_member_sync
after update of hourly_rate,profile_kind on public.member_profiles
for each row execute function private.sathivo_sync_saved_hourly_rate();

-- Also protect against stale clients writing an older rate to an existing card.
-- Run before the existing rate guard. Preserve legacy rates when no saved rate exists.
create function private.sathivo_canonical_listing_hourly_rate() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_rate integer;
begin
  if new.published then
    select p.hourly_rate into v_rate from public.member_profiles p
    where p.user_id=new.user_id and p.profile_kind in ('companion','both')
      and p.hourly_rate between 1 and 100000;
    if v_rate is not null then new.hourly_rate:=v_rate; end if;
  end if;
  return new;
end $$;
revoke all on function private.sathivo_canonical_listing_hourly_rate() from public,anon,authenticated;
create trigger a_sathivo_canonical_listing_hourly_rate
before insert or update of hourly_rate,published on public.companion_listings
for each row execute function private.sathivo_canonical_listing_hourly_rate();

-- Reconcile only existing published cards with a valid member-chosen rate.
update public.companion_listings l set hourly_rate=p.hourly_rate
from public.member_profiles p
where l.user_id=p.user_id and l.published and l.moderation_status='active'
  and p.profile_kind in ('companion','both') and p.hourly_rate between 1 and 100000
  and l.hourly_rate is distinct from p.hourly_rate;
