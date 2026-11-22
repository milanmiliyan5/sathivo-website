-- Sathivo 21-activity announcement: one opportunity per existing companion.
-- Eligibility is snapshotted at migration time, based on a companion profile
-- already existing before the 21-category rollout; new accounts cannot join
-- this table and normal users cannot reset their displayed notice.
create table if not exists public.companion_activity_update_prompts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shown_at timestamptz
);
alter table public.companion_activity_update_prompts enable row level security;

revoke all on public.companion_activity_update_prompts from public, anon, authenticated;
grant select(user_id,shown_at), update(shown_at)
 on public.companion_activity_update_prompts to authenticated;

drop policy if exists companion_activity_prompt_read_own
 on public.companion_activity_update_prompts;
create policy companion_activity_prompt_read_own
 on public.companion_activity_update_prompts
 for select to authenticated
 using ((select auth.uid())=user_id);

drop policy if exists companion_activity_prompt_claim_once
 on public.companion_activity_update_prompts;
create policy companion_activity_prompt_claim_once
 on public.companion_activity_update_prompts
 for update to authenticated
 using ((select auth.uid())=user_id and shown_at is null)
 with check ((select auth.uid())=user_id and shown_at is not null);

insert into public.companion_activity_update_prompts(user_id)
select p.user_id
from public.member_profiles p
where p.profile_kind in ('companion','both')
  and p.joined_at < timestamptz '2026-11-22 17:56:01+00'
on conflict (user_id) do nothing;

comment on table public.companion_activity_update_prompts is
 'Eligible prior companion members for a one-time 2026-11-22 21-activity website announcement. No personal information, messages, or category selection stored here.';
