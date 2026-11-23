import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Chat avatar reads current account DP via booking-scoped RPC, not stale Explore snapshot',async()=>{
  const code=await read('js/chat-avatars.js');
  assert.match(code,/rpc\('sathivo_chat_contact_avatars',\{p_user_ids:batch\}\)/);
  assert.match(code,/storage\.from\('profile-photos'\)\.createSignedUrls\(uploads,300\)/);
  assert.doesNotMatch(code,/from\('companion_listings'\)/);
  assert.doesNotMatch(code,/storage\.from\('listing-photos'\)/);
  assert.match(code,/element\.dataset\.avatarLoad/);
  assert.match(code,/avatarAsset\(path\)/);
  assert.match(code,/if\(current\(\)\&\&element\.isConnected\)element\.replaceChildren\(image\)/);
});

test('Both chat routes import cache-busted current-DP code',async()=>{
  const avatarImport='chat-avatars.js?v=20261122-current-account-dp-1';
  assert.ok((await read('js/chat-page.js')).includes(avatarImport));
  assert.ok((await read('js/chats-page.js')).includes(avatarImport));
  assert.ok((await read('chat.html')).includes('js/chat-page.js?v=20261123-premium-chat-2'));
  assert.ok((await read('chats.html')).includes('js/chats-page.js?v=20261122-current-account-dp-1'));
});

test('Chat-avatar DB access remains restricted to booking partners and private storage',async()=>{
  const sql=await read('supabase/migrations/20261122092000_private_booking_chat_current_avatars.sql');
  assert.match(sql,/security definer/);
  assert.match(sql,/b\.status in \('accepted','completed','cancelled'\)/);
  assert.match(sql,/revoke all on function public\.sathivo_chat_contact_avatars\(uuid\[\]\) from public, anon/);
  assert.match(sql,/grant execute on function public\.sathivo_chat_contact_avatars\(uuid\[\]\) to authenticated/);
  assert.match(sql,/bucket_id = 'profile-photos'/);
  assert.doesNotMatch(sql,/grant .* to anon/i);
});
