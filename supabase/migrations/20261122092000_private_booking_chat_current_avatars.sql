-- Display the current Account DP to authorized booking chat partners only.
-- Do not overwrite or republish the separately consented public Explore photo.
create function public.sathivo_chat_contact_avatars(p_user_ids uuid[])
returns table(user_id uuid, avatar_path text)
language sql stable security definer
set search_path = ''
as $$
  select p.user_id, p.avatar_path
  from public.member_profiles as p
  where (select auth.uid()) is not null
    and cardinality(coalesce(p_user_ids, array[]::uuid[])) <= 100
    and p.user_id = any(coalesce(p_user_ids, array[]::uuid[]))
    and exists (
      select 1 from public.booking_requests as b
      where b.status in ('accepted','completed','cancelled')
        and (
          (b.customer_id = (select auth.uid()) and b.companion_id = p.user_id)
          or (b.companion_id = (select auth.uid()) and b.customer_id = p.user_id)
        )
    )
  limit 100;
$$;
revoke all on function public.sathivo_chat_contact_avatars(uuid[]) from public, anon;
grant execute on function public.sathivo_chat_contact_avatars(uuid[]) to authenticated;

-- Supabase Storage private bucket stays private; this helper only approves a
-- current uploaded avatar for a user already linked by an accepted/past booking.
create function public.sathivo_can_read_chat_profile_avatar(p_path text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.member_profiles as p
      where p.avatar_path = p_path
        and p.avatar_path = p.user_id::text || '/avatar.webp'
        and exists (
          select 1 from public.booking_requests as b
          where b.status in ('accepted','completed','cancelled')
            and (
              (b.customer_id = (select auth.uid()) and b.companion_id = p.user_id)
              or (b.companion_id = (select auth.uid()) and b.customer_id = p.user_id)
            )
        )
    );
$$;
revoke all on function public.sathivo_can_read_chat_profile_avatar(text) from public, anon;
grant execute on function public.sathivo_can_read_chat_profile_avatar(text) to authenticated;

create policy chat_partner_current_profile_photo_read
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and public.sathivo_can_read_chat_profile_avatar(name)
);
