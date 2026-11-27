-- One acknowledgement per booking and companion; no payment data or chat changes.
create table public.booking_payment_safety_acknowledgements (
 booking_id uuid primary key references public.booking_requests(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 acknowledged_at timestamptz not null default now()
);
create index booking_payment_safety_ack_user_idx on public.booking_payment_safety_acknowledgements(user_id);
alter table public.booking_payment_safety_acknowledgements enable row level security;
revoke all on public.booking_payment_safety_acknowledgements from public, anon, authenticated;
grant select, insert on public.booking_payment_safety_acknowledgements to authenticated;
grant all on public.booking_payment_safety_acknowledgements to service_role;
create policy payment_safety_owner_read on public.booking_payment_safety_acknowledgements
 for select to authenticated using (user_id=(select auth.uid()));
create policy payment_safety_companion_insert on public.booking_payment_safety_acknowledgements
 for insert to authenticated with check (
 user_id=(select auth.uid()) and exists (
 select 1 from public.booking_requests b where b.id=booking_id
 and b.companion_id=(select auth.uid()) and b.status='accepted'
 ));
