create function private.sathivo_sync_visible_gender_from_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.gender is distinct from old.gender then
  update public.companion_listings l
  set public_gender=case when new.gender in ('male','female','other') then new.gender else null end
  where l.user_id=new.user_id and l.public_gender is not null
    and l.public_gender is distinct from new.gender;
 end if;
 return new;
end $$;
revoke all on function private.sathivo_sync_visible_gender_from_member() from public,anon,authenticated;
create trigger sathivo_visible_gender_member_sync after update of gender on public.member_profiles for each row execute function private.sathivo_sync_visible_gender_from_member();

create function private.sathivo_canonical_public_gender() returns trigger language plpgsql security definer set search_path='' as $$
declare v_gender text;
begin
 if new.public_gender is not null then
  select p.gender into v_gender from public.member_profiles p where p.user_id=new.user_id;
  new.public_gender:=case when v_gender in ('male','female','other') then v_gender else null end;
 end if;
 return new;
end $$;
revoke all on function private.sathivo_canonical_public_gender() from public,anon,authenticated;
create trigger sathivo_visible_gender_listing_sync before insert or update of public_gender on public.companion_listings for each row execute function private.sathivo_canonical_public_gender();

update public.companion_listings l
set public_gender=case when m.gender in ('male','female','other') then m.gender else null end
from public.member_profiles m
where m.user_id=l.user_id and l.public_gender is not null and l.public_gender is distinct from m.gender;
