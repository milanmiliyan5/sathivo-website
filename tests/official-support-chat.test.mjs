import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeMessages} from '../js/official-support-common.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('only chat list exposes floating official support entry and new route is allowed',async()=>{
 const page=await read('chats.html'),detail=await read('support-chat.html'),home=await read('index.html'),booking=await read('chat.html'),notifications=await read('js/notifications-page.js');
 assert.match(page,/id="official-support-launcher"[^>]*href="support-chat.html"/);
 assert.doesNotMatch(home+booking,/id="official-support-launcher"/);
 assert.match(detail,/Sathivo Official/);assert.match(detail,/interactive-widget=resizes-content/);
 assert.match(notifications,/'support-chat.html'/);
});
test('message merge deduplicates and preserves read receipts',()=>{
 const a={id:'a',created_at:'2026-11-26T10:00:00Z',read_at:null},b={id:'b',created_at:'2026-11-26T10:01:00Z'};
 assert.deepEqual(mergeMessages([b,a],[{...a,read_at:'now'}]),[{...a,read_at:'now'},b]);
});
test('support tables cascade on deletion and constrain official sender and private reads',async()=>{
 const sql=await read('supabase/migrations/20261126122845_official_support_chat_private.sql');
 assert.match(sql,/references auth.users\(id\) on delete cascade/i);
 assert.match(sql,/references public.official_support_threads\(user_id\) on delete cascade/i);
 assert.match(sql,/enable row level security/i);assert.match(sql,/sender='official' and exists/);
 assert.match(sql,/role='owner'/);assert.match(sql,/grant update\(read_at\)/i);
 assert.match(sql,/official-support-reply:/);
});
