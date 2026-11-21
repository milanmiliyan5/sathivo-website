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
 for(const id of ['chat-avatar','chat-title','presence-status','chat-booking-pill','chat-context','messages','jump-latest','message-form','photo-input','photo-draft','view-once','message','send-message','safety-actions','report-user','block-user']){
   assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 assert.match(css,/\.chat-workspace\{[\s\S]*?grid-template-columns:minmax\(275px,330px\) minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:960px\)\{[\s\S]*?\.chat-inbox-panel\{display:none\}/);
 assert.match(css,/@media\(max-width:640px\)\{[\s\S]*?\.chat-workspace\{/);
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
