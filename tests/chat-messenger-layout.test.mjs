import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('private chat keeps its current DOM controls inside responsive two-column workspace',async()=>{
 const html=await read('chat.html'),css=await read('chat-premium.css');
 assert.match(html,/<div class="chat-workspace container" aria-label="Sathivo private messenger">/);
 assert.match(html,/<aside class="chat-inbox-panel" aria-label="Your booking conversations">/);
 assert.match(html,/id="chat-inbox-list"/);
 assert.match(html,/<main id="main" class="chat-shell">/);
 for(const id of ['chat-avatar','chat-title','presence-status','chat-booking-pill','messages','jump-latest','message-form','photo-input','photo-draft','view-once','message','send-message','safety-actions','report-user','block-user']){
   assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 assert.match(css,/\.chat-workspace\{[\s\S]*?grid-template-columns:minmax\(275px,330px\) minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:960px\)\{[\s\S]*?\.chat-inbox-panel\{display:none\}/);
 assert.match(css,/@media\(max-width:640px\)\{[\s\S]*?\.chat-workspace\{/);
 assert.match(html,/class="chat-context"/);
 assert.match(html,/href="safety\.html#first-meeting"/);
 assert.match(html,/href="privacy\.html"/);
});
test('desktop inbox is an authorized one-shot view of the existing booking chat list',async()=>{
 const js=await read('js/chat-page.js');
 assert.match(js,/async function loadDesktopInbox\(\)/);
 assert.match(js,/if\(!list\|\|!client\|\|!user\|\|!booking\|\|desktopInboxLoaded\|\|desktopInboxLoading/);
 assert.match(js,/matchMedia\('\(min-width: 961px\)'\)/);
 assert.match(js,/client\.rpc\('get_chat_list'\)/);
 assert.match(js,/withCurrentBookingNames\(client,data\|\|\[\]\)/);
 assert.match(js,/a\.href='chat\.html\?booking='\+encodeURIComponent\(r\.booking_id\)/);
 assert.match(js,/r\.booking_id===booking\.id/);
 assert.match(js,/void showChatAvatars\(client,avatarContacts\)/);
 const sidebar=js.split('async function loadDesktopInbox()')[1].split('\nfunction nearBottom()')[0];
 assert.doesNotMatch(sidebar,/\.insert\(|\.update\(|\.delete\(|setInterval\(/);
});
test('real messaging functionality and private media are preserved',async()=>{
 const html=await read('chat.html'),js=await read('js/chat-page.js');
 assert.match(js,/\.from\('booking_messages'\)\.insert\(/);
 assert.match(js,/sendStagedPhoto\(\)/);
 assert.match(js,/openViewOnce\(r\)/);
 assert.match(js,/client\.channel\('booking-messages:'\+booking\.id\)/);
 assert.match(js,/setupPresence\(\)/);
 assert.match(js,/sendTyping\(\)/);
 assert.match(js,/const state=deliveryLabel\(r\),tick=el\('span',state==='Sent'\?'✓':'✓✓'/);
 assert.match(js,/tick\.title=state;tick\.setAttribute\('aria-label',state\)/);
 assert.match(html,/id="publish-consent"|Private booking conversation/);
});

test('mobile bottom tabs are omitted only from individual conversation and composer gets the space',async()=>{
 const html=await read('chat.html'),css=await read('chat-premium.css');
 assert.doesNotMatch(html,/js\/mobile-nav\.js/);
 assert.match(html,/<a class="chat-back" href="chats\.html"/);
 assert.match(html,/chat-premium\.css\?v=20261123-keyboard-composer-1/);
 assert.match(css,/body\.sathivo-2d\.chat-premium \.mobile-bottom-nav\{display:none!important\}/);
 assert.match(css,/\.chat-workspace\{\s*height:max\(330px,calc\(100dvh - 96px\)\)/);
 assert.match(css,/body\.sathivo-2d\.chat-premium\.chat-input-focused \.chat-workspace\{/);
});

test('keyboard-safe mobile composer and paperclip preserve real photo attachment',async()=>{
 const html=await read('chat.html'),css=await read('chat-premium.css'),js=await read('js/chat-page.js');
 assert.match(html,/interactive-widget=resizes-content/);
 assert.match(html,/id="attach-photo"[^>]*><svg/);
 assert.match(html,/id="photo-input" type="file"/);
 assert.doesNotMatch(html,/>📷<\/button>/);
 assert.match(css,/top:var\(--chat-visible-top,0px\)!important/);
 assert.match(css,/height:var\(--chat-visible-vh,100dvh\)!important/);
 assert.match(css,/\.chat-input-focused \.chat-compose-hint\{display:none!important\}/);
 assert.match(css,/\.chat-input-focused \.directory-footer\{display:none!important\}/);
 assert.match(js,/viewport\?\.height\?\?window\.innerHeight/);
 assert.match(js,/viewport\?\.offsetTop\?\?0/);
 assert.match(js,/requestAnimationFrame\(syncChatKeyboard\)/);
 assert.match(js,/addEventListener\('blur',resetChatKeyboard\)/);
 assert.match(js,/\$\('attach-photo'\)\.onclick=\(\)=>\$\('photo-input'\)\.click\(\)/);
});
