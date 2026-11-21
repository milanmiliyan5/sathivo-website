-- Sathivo booking chat: per-person hiding and sender-only global redaction.
-- Additive migration: does NOT delete or rewrite existing messages.
create table if not exists public.booking_message_hides (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.booking_messages(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id,message_id)
);
alter table public.booking_message_hides enable row level security;
revoke all on public.booking_message_hides from public, anon, authenticated;
grant select on public.booking_message_hides to authenticated;
create policy booking_message_hides_read_own
on public.booking_message_hides for select to authenticated
using (user_id = (select auth.uid()));

-- A private-to-service-role photo cleanup queue is populated transactionally
-- before a globally deleted message loses its private storage pointer.
create table if not exists public.booking_media_cleanup_queue (
  message_id uuid primary key,
  photo_path text not null,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text
);
alter table public.booking_media_cleanup_queue enable row level security;
revoke all on public.booking_media_cleanup_queue from public, anon, authenticated;
grant select, update, delete on public.booking_media_cleanup_queue to service_role;

alter table public.booking_messages
  add column if not exists deleted_for_everyone_at timestamptz;

-- Apply per-user hiding to every read path (web, Android and get_chat_list()).
-- Preserve the previous participant/admin scope, with only the new hide filter.
alter policy messages_read_participants on public.booking_messages
using (
  not exists (
    select 1 from public.booking_message_hides h
    where h.message_id = booking_messages.id
      and h.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.booking_requests b
    where b.id = booking_messages.booking_id
      and (
        (select auth.uid()) in (b.customer_id,b.companion_id)
        or exists (
          select 1 from public.platform_admins a
          where a.user_id = (select auth.uid())
        )
      )
  )
);

-- SECURITY DEFINER is used only for one carefully bounded, authenticated
-- message action. No direct UPDATE/DELETE privilege is granted on messages.
create or replace function public.delete_booking_message(
  p_message_id uuid,
  p_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
declare
  v_actor uuid := auth.uid();
  v_message public.booking_messages%rowtype;
begin
  if v_actor is null then
    raise exception 'Sign in required' using errcode='28000';
  end if;
  if p_message_id is null or p_scope not in ('me','everyone') or p_scope is null then
    raise exception 'Invalid message or action' using errcode='22023';
  end if;

  select m.* into v_message
  from public.booking_messages m
  where m.id = p_message_id
  for update;
  if not found then
    raise exception 'Message not found' using errcode='P0002';
  end if;

  if not exists (
    select 1 from public.booking_requests b
    where b.id=v_message.booking_id
      and v_actor in (b.customer_id,b.companion_id)
  ) then
    raise exception 'Not a booking participant' using errcode='42501';
  end if;

  if p_scope = 'me' then
    insert into public.booking_message_hides(user_id,message_id)
    values(v_actor,v_message.id)
    on conflict (user_id,message_id) do nothing;
    return jsonb_build_object('ok',true,'scope','me');
  end if;

  if v_message.sender_id <> v_actor then
    raise exception 'Only the sender may delete for everyone' using errcode='42501';
  end if;
  if v_message.deleted_for_everyone_at is not null then
    return jsonb_build_object('ok',true,'scope','everyone','already_deleted',true);
  end if;

  if v_message.photo_path is not null then
    insert into public.booking_media_cleanup_queue(message_id,photo_path)
    values(v_message.id,v_message.photo_path)
    on conflict (message_id) do nothing;
  end if;

  update public.booking_messages
  set
    body='This message was deleted',
    message_type='text',
    photo_path=null,
    view_once=false,
    viewed_at=null,
    viewed_by=null,
    deleted_for_everyone_at=now()
  where id=v_message.id;

  return jsonb_build_object('ok',true,'scope','everyone','had_photo',v_message.photo_path is not null);
end;
$func$;

revoke all on function public.delete_booking_message(uuid,text) from public, anon;
grant execute on function public.delete_booking_message(uuid,text) to authenticated;

comment on function public.delete_booking_message(uuid,text)
is 'Authenticated booking participants can hide a message for themselves; sender alone can redact message body and photo reference for everyone.';
