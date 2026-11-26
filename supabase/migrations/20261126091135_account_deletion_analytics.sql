create table public.account_deletion_events (
 id uuid primary key default gen_random_uuid(),
 deleted_at timestamptz not null default now(),
 account_kind text not null check (account_kind in ('customer','companion','both','not_set','unknown')),
 account_age_days integer check (account_age_days is null or account_age_days >= 0),
 reason text not null default 'not_provided' check (reason in ('no_companions','no_responses','not_interested','technical','privacy_safety','other','not_provided')),
 feedback text check (feedback is null or char_length(feedback) <= 500)
);
alter table public.account_deletion_events enable row level security;
revoke all on public.account_deletion_events from public, anon, authenticated;
grant select on public.account_deletion_events to authenticated;
grant select, insert on public.account_deletion_events to service_role;
create policy account_deletion_events_owner_read on public.account_deletion_events for select to authenticated using (
 exists (select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner')
);
create index account_deletion_events_date_idx on public.account_deletion_events (deleted_at desc,id desc);
comment on table public.account_deletion_events is 'Completed self-service account deletions only. No account ID, email, name, photo or chat is retained here. Optional feedback is user-submitted and must not include identifying details.';
