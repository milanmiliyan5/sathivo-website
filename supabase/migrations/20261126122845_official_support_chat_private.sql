
create table public.official_support_threads (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'open' check(status in ('open','pending','resolved')),
 created_at timestamptz not null default now(),
 last_message_at timestamptz,
 last_sender text check(last_sender in ('member','official'))
);
create table public.official_support_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.official_support_threads(user_id) on delete cascade,
 sender text not null check(sender in ('member','official')),
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index official_support_messages_thread_time on public.official_support_messages(user_id,created_at desc,id desc);
create index official_support_messages_unread on public.official_support_messages(user_id,sender) where read_at is null;
create index official_support_threads_recent on public.official_support_threads(last_message_at desc,user_id);
alter table public.official_support_threads enable row level security;
alter table public.official_support_messages enable row level security;
revoke all on public.official_support_threads,public.official_support_messages from public,anon,authenticated;
grant select on public.official_support_threads,public.official_support_messages to authenticated;
grant insert(user_id) on public.official_support_threads to authenticated;
grant update(status) on public.official_support_threads to authenticated;
grant insert(id,user_id,sender,body) on public.official_support_messages to authenticated;
grant update(read_at) on public.official_support_messages to authenticated;
create policy official_thread_read on public.official_support_threads for select to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
create policy official_thread_create on public.official_support_threads for insert to authenticated with check (user_id=(select auth.uid()));
create policy official_thread_owner_status on public.official_support_threads for update to authenticated using (exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner')) with check (exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
create policy official_message_read on public.official_support_messages for select to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'));
create policy official_message_send on public.official_support_messages for insert to authenticated with check ((sender='member' and user_id=(select auth.uid())) or (sender='official' and exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner')));
create policy official_message_ack on public.official_support_messages for update to authenticated using ((sender='official' and user_id=(select auth.uid())) or (sender='member' and exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner'))) with check ((sender='official' and user_id=(select auth.uid())) or (sender='member' and exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner')));
-- Allow only the official-support notification destination in addition to the existing destination.
alter table public.website_notifications drop constraint website_notifications_link_check;
alter table public.website_notifications add constraint website_notifications_link_check check(link='index.html' or (link='support-chat.html' and campaign_key like 'official-support-reply:%'));
create function private.official_support_message_record() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to send a message'; end if;
 if new.sender='member' and new.user_id<>auth.uid() then raise exception 'Not authorized'; end if;
 if new.sender='official' and not exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.role='owner') then raise exception 'Not authorized'; end if;
 -- Serialize sends for the same thread. Rate limits use server timestamps only.
 perform 1 from public.official_support_threads where user_id=new.user_id for update;
 if new.sender='member' and (
  (select count(*) from public.official_support_messages m where m.user_id=new.user_id and m.sender='member' and m.created_at>now()-interval '1 minute')>12
  or (select count(*) from public.official_support_messages m where m.user_id=new.user_id and m.sender='member' and m.created_at>now()-interval '1 day')>80
 ) then raise exception 'Message limit reached. Please try again later.'; end if;
 update public.official_support_threads set last_message_at=greatest(last_message_at,new.created_at), last_sender=case when last_message_at is null or new.created_at>=last_message_at then new.sender else last_sender end,status=case when new.sender='member' then 'open' when status='resolved' then 'open' else status end where user_id=new.user_id;
 if new.sender='official' then
  insert into public.website_notifications(user_id,campaign_key,kind,title,body,link)
  values(new.user_id,'official-support-reply:'||new.id::text,'system','Sathivo Support replied','You have a new reply from Sathivo Official.','support-chat.html')
  on conflict(user_id,campaign_key) do nothing;
 end if;
 return new;
end; $$;
revoke all on function private.official_support_message_record() from public,anon,authenticated;
create trigger official_support_record after insert on public.official_support_messages for each row execute function private.official_support_message_record();
-- Invoker function: RLS remains active. Only owners can list support conversations.
create function public.official_support_inbox(p_offset integer default 0,p_limit integer default 30,p_status text default null,p_search text default null)
returns table(user_id uuid,display_name text,status text,last_message_at timestamptz,last_sender text,unread_count bigint,preview text)
language sql stable security invoker set search_path='' as $$
 select t.user_id,coalesce(p.display_name,'Sathivo member'),t.status,t.last_message_at,t.last_sender,
 (select count(*) from public.official_support_messages m where m.user_id=t.user_id and m.sender='member' and m.read_at is null),
 (select left(m.body,120) from public.official_support_messages m where m.user_id=t.user_id order by m.created_at desc,m.id desc limit 1)
 from public.official_support_threads t left join public.member_profiles p on p.user_id=t.user_id
 where exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.role='owner')
 and t.last_message_at is not null and (p_status is null or t.status=p_status)
 and (p_search is null or position(lower(btrim(p_search)) in lower(coalesce(p.display_name,'Sathivo member')))>0 or t.user_id::text=p_search)
 order by t.last_message_at desc,t.user_id
 offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,30),1),51);
$$;
revoke all on function public.official_support_inbox(integer,integer,text,text) from public,anon;
grant execute on function public.official_support_inbox(integer,integer,text,text) to authenticated;
alter publication supabase_realtime add table public.official_support_messages;
