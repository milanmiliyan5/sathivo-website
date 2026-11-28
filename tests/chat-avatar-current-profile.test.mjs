import {assertVersionedAsset} from './versioned-asset.mjs';
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
  const avatarImport='chat-avatars.js?v=20261123-avatar-square-1';
  assert.ok((await read('js/chat-page.js')).includes(avatarImport));
  assert.ok((await read('js/chats-page.js')).includes(avatarImport));
  assertVersionedAsset(await read('chat.html'), 'js/chat-page.js', '20261125');
  assertVersionedAsset(await read('chats.html'), 'js/chats-page.js', '20261125');
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

test('all booking chat DPs crop inside fixed circular frames without stretching',async()=>{
 const avatar=await read('js/chat-avatars.js');
 const listCss=await read('marketplace.css');
 const chatCss=await read('chat-premium.css');
 assert.match(avatar,/image\.className='chat-contact-photo'/);
 assert.doesNotMatch(avatar,/image\.style\.cssText='display:block;width:100%;height:100%/);
 assert.match(listCss,/\.chat-list-card \.chat-list-avatar\{/);
 assert.match(listCss,/aspect-ratio:1\/1!important;overflow:hidden!important/);
 assert.match(listCss,/\.chat-list-card \.chat-list-avatar>\.chat-contact-photo\{/);
 assert.match(chatCss,/\.chat-workspace \.chat-avatar>\.chat-contact-photo/);
 assert.match(chatCss,/position:absolute!important;inset:0!important;display:block!important/);
 assert.match(chatCss,/object-fit:cover!important;object-position:center!important/);
 assert.match(chatCss,/clip-path:circle\(50% at 50%\)/);
 assert.match(chatCss,/\.chat-avatar\.is-online::after/);
});

test('Chat list displays a stable Explore-style serif heading above messages',async()=>{
 const html=await read('chats.html');
 const css=await read('chats-compact.css');
 const js=await read('js/chats-page.js');
 const title='<section class="chats-page-intro" aria-labelledby="chats-title"><h1 id="chats-title">Chats</h1></section>';
 assert.ok(html.includes(title));
 assert.ok(html.indexOf(title)<html.indexOf('id="chats" class="chat-list"'));
 assert.match(html,/chats-compact\.css\?v=20261125-stable-inbox-1/);
 assert.doesNotMatch(html,/PRIVATE CONVERSATIONS|Your chats\.|7 chats/);
 const match=css.match(/body\.sathivo-2d \.chats-list-compact \.chats-page-intro h1\{([^}]+)\}/);
 assert.ok(match,'Chats title rule exists');
 for(const declaration of [
  'font-family:var(--serif)',
  'font-size:clamp(1.45rem,3.3vw,2rem)!important',
  'text-align:left!important',
  'visibility:visible!important',
  'opacity:1!important',
  'transform:none!important',
  'background:transparent!important',
  'border:0!important',
  'box-shadow:none!important'
 ])assert.ok(match[1].includes(declaration),declaration);
 assert.match(css,/\.chats-page-intro h1\{\s*font-size:1\.45rem!important;line-height:1\.18/);
 assert.doesNotMatch(js,/getElementById\('chats-title'\)/);
});

test('Compact inbox rows are scoped to Chats and preserve all booking and message metadata',async()=>{
 const css=await read('chats-compact.css');
 const js=await read('js/chats-page.js');
 assert.match(css,/\.chats-list-compact #chats\{\s*gap:7px/);
 assert.match(css,/\.chats-list-compact #chats \.chat-list-card\{[^}]*padding:8px 12px/);
 assert.match(css,/--inbox-avatar-size:40px/);
 assert.match(css,/--inbox-avatar-size:36px/);
 assert.match(css,/\.chat-list-meta\{\s*display:block/);
 for(const field of ['other_display_name','last_message','last_message_at','booking_status','unread_count','showChatAvatars'])assert.ok(js.includes(field));
 assert.doesNotMatch(css,/\.chat-workspace|\.chat-composer/);
});
