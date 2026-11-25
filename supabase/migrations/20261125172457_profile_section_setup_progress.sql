alter table public.member_profiles add column if not exists setup_stage text check (setup_stage in ('personal','companion','privacy','complete'));
comment on column public.member_profiles.setup_stage is 'Optional owner-editable onboarding UI progress only; never an authorization or safety decision. NULL retains legacy profile behavior.';
