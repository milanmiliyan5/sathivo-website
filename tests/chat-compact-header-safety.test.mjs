import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('only one compact safety menu exists in chat header; safety actions remain available',async()=>{
 const html=await read('chat.html');
 assert.match(html,/<div class="chat-head-top">/);
 assert.match(html,/<details id="chat-safety-menu" class="chat-safety-menu" hidden>/);
 assert.match(html,/<summary aria-label="Chat safety and support options">/);
 assert.match(html,/<section id="safety-actions" class="safety-actions" aria-label="Chat safety and help">/);
 for(const id of ['safety-actions','report-user','block-user','chat-safety-menu']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 for(const text of ['Report User','Block User','Contact Support','Safety &amp; Help','Booking details &amp; safety']){
  assert.ok(html.includes(text),text);
 }
 assert.ok(html.indexOf('id="chat-safety-menu"')<html.indexOf('class="chat-person-row"'));
 assert.ok(html.indexOf('id="safety-actions"')<html.indexOf('</section>\n<p id="status"'));
 assert.doesNotMatch(html,/<section id="safety-actions"[^>]*hidden/);
 assert.match(html,/id="chat-inbox-list"/);
});
test('menu is shown only after authorized chat init and can close with keyboard or outside click',async()=>{
 const script=await read('js/chat-page.js');
 assert.match(script,/const safetyMenu=\$\('chat-safety-menu'\)/);
 assert.match(script,/safetyMenu\.hidden=false/);
 assert.match(script,/safetyMenu\.open&&!safetyMenu\.contains\(event\.target\)/);
 assert.match(script,/event\.key==='Escape'&&safetyMenu\.open/);
 assert.match(script,/safetyMenu\.querySelector\('summary'\)\?\.focus\(\)/);
 assert.match(script,/\$\('report-user'\)\.onclick=\(\)=>void report\(\)/);
 assert.match(script,/\$\('block-user'\)\.onclick=\(\)=>void block\(\)/);
 assert.match(script,/\.from\('user_blocks'\)\.insert\(/);
 assert.match(script,/openSafetyReport\(/);
});
test('header is reduced only by CSS and private conversation structure stays unchanged',async()=>{
 const html=await read('chat.html'),css=await read('chat-premium.css'),script=await read('js/chat-page.js');
 assert.match(css,/\.chat-workspace \.chat-head\{\s*position:relative;padding:9px 18px 8px/);
 assert.match(css,/\.chat-workspace \.chat-avatar\{\s*width:40px;height:40px/);
 assert.match(css,/\.chat-safety-menu #safety-actions\{[\s\S]*?position:absolute;/);
 assert.match(css,/\.chat-safety-menu\[hidden\]\{display:none!important\}/);
 assert.match(css,/@media\(max-width:640px\)\{[\s\S]*?\.chat-safety-menu>summary/);
 for(const id of ['chat-avatar','chat-title','presence-status','chat-booking-pill','messages','message-form','photo-input','view-once','message','send-message']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(script,/client\.rpc\('get_chat_list'\)/);
 assert.match(script,/r\.booking_id===booking\.id/);
 assert.match(script,/\.from\('booking_messages'\)\.insert\(/);
 assert.match(script,/openViewOnce\(r\)/);
});
