import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Delete for me and Delete for everyone appear only in a message-specific dialog',async()=>{
 const html=await read('chat.html'),js=await read('js/chat-page.js'),css=await read('chat-premium.css');
 for(const id of ['message-delete-dialog','message-delete-me','message-delete-everyone','message-delete-cancel']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 assert.match(html,/<dialog id="message-delete-dialog"/);
 assert.match(html,/id="message-delete-everyone"[^>]*hidden/);
 assert.match(html,/Other people may already have seen or saved it/);
 assert.match(js,/selectedDeleteMessage=\{id:r\.id,isMine:r\.sender_id===user\.id,isRedacted:Boolean\(r\.deleted_for_everyone_at\)\}/);
 assert.match(js,/\$\('message-delete-everyone'\)\.hidden=!selectedDeleteMessage\.isMine\|\|selectedDeleteMessage\.isRedacted/);
 assert.match(js,/scope==='everyone'[\s\S]*?if\(!selected\.isMine\|\|selected\.isRedacted\)return/);
 assert.match(js,/client\.functions\.invoke\('delete-chat-message'/);
 assert.match(js,/deleteRequestRunning/);
 assert.match(css,/\.messages \.message \.message-options-trigger/);
 assert.match(css,/\.message-delete-dialog::backdrop/);
 assert.match(css,/\.message-delete-option\[hidden\]/);
});

test('Deleting one message does not alter other booking messages or remove moderation controls',async()=>{
 const js=await read('js/chat-page.js'),html=await read('chat.html');
 assert.match(js,/options\.onclick=\(\)=>openMessageDeleteOptions\(r\)/);
 assert.match(js,/body:\{message_id:selected\.id,scope\}/);
 assert.match(js,/await loadMessages\(false\)/);
 assert.match(js,/desktopInboxLoaded=false/);
 assert.match(js,/client\.rpc\('get_chat_list'\)/);
 assert.match(js,/client\.channel\('booking-messages:'\+booking\.id\)/);
 assert.match(js,/\.from\('booking_messages'\)\.insert\(/);
 assert.match(js,/openViewOnce\(r\)/);
 for(const s of ['id="report-user"','id="block-user"','id="message-form"','id="chat-inbox-list"'])assert.ok(html.includes(s),s);
});

test('Database enforces authenticated participants, sender-only global redaction and user-only hiding',async()=>{
 const sql=await read('supabase/migrations/20261121203609_chat_message_private_and_global_deletion.sql');
 assert.match(sql,/create table if not exists public\.booking_message_hides/);
 assert.match(sql,/primary key \(user_id,message_id\)/);
 assert.match(sql,/alter table public\.booking_message_hides enable row level security/);
 assert.match(sql,/revoke all on public\.booking_message_hides from public, anon, authenticated/);
 assert.match(sql,/user_id = \(select auth\.uid\(\)\)/);
 assert.match(sql,/alter policy messages_read_participants/);
 assert.match(sql,/not exists \([\s\S]*?from public\.booking_message_hides h/);
 assert.match(sql,/create or replace function public\.delete_booking_message/);
 assert.match(sql,/security definer/);
 assert.match(sql,/v_actor in \(b\.customer_id,b\.companion_id\)/);
 assert.match(sql,/if v_message\.sender_id <> v_actor then/);
 assert.match(sql,/on conflict \(user_id,message_id\) do nothing/);
 assert.match(sql,/body='This message was deleted'/);
 assert.match(sql,/photo_path=null/);
 assert.match(sql,/revoke all on function public\.delete_booking_message\(uuid,text\) from public, anon/);
 assert.match(sql,/grant execute on function public\.delete_booking_message\(uuid,text\) to authenticated/);
 assert.doesNotMatch(sql,/delete from public\.booking_messages/);
});

test('Private photo deletion queue is never exposed to visitors and is cleaned with server credential',async()=>{
 const sql=await read('supabase/migrations/20261121203609_chat_message_private_and_global_deletion.sql');
 const edge=await read('supabase/functions/delete-chat-message/index.ts');
 assert.match(sql,/create table if not exists public\.booking_media_cleanup_queue/);
 assert.match(sql,/alter table public\.booking_media_cleanup_queue enable row level security/);
 assert.match(sql,/revoke all on public\.booking_media_cleanup_queue from public, anon, authenticated/);
 assert.match(sql,/grant select, update, delete on public\.booking_media_cleanup_queue to service_role/);
 assert.match(sql,/insert into public\.booking_media_cleanup_queue\(message_id,photo_path\)/);
 assert.match(edge,/auth\.getUser\(token\)/);
 assert.match(edge,/caller\.rpc\("delete_booking_message"/);
 assert.match(edge,/admin\.storage\.from\("booking-chat-photos"\)\.remove\(\[row\.photo_path\]\)/);
 assert.match(edge,/\.delete\(\)\.eq\("message_id",row\.message_id\)/);
 assert.doesNotMatch(edge,/return json\(req,\{[^\n]*photo_path:/);
});
