alter table public.member_profiles
  drop constraint if exists member_profiles_check;

alter table public.member_profiles
  add constraint member_profiles_check
  check (
    avatar_path is null
    or avatar_path = (user_id::text || '/avatar.webp')
    or avatar_path in (
      'builtin:male-1','builtin:male-2','builtin:male-3',
      'builtin:female-1','builtin:female-2','builtin:female-3'
    )
  );

alter table public.companion_listings
  drop constraint if exists companion_listings_check;

alter table public.companion_listings
  add constraint companion_listings_check
  check (
    photo_path is null
    or photo_path = (user_id::text || '/avatar.webp')
    or photo_path in (
      'builtin:male-1','builtin:male-2','builtin:male-3',
      'builtin:female-1','builtin:female-2','builtin:female-3'
    )
  );
