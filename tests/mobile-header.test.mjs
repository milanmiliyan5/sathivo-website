import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const pages=["companions.html","companion.html","profile.html","requests.html","bookings.html","chats.html","chat.html","account.html","notifications.html"];
test('internal pages share a compact mobile header with exactly one notification shortcut',async()=>{
 for(const page of pages){
  const html=await read(page);
  const header=html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0]||'';
  assert.match(header,/compact-header/,page);
  assert.match(header,/desktop-header-links/,page);
  assert.equal((header.match(/class="notification-shortcut"/g)||[]).length,1,page);
  assert.equal((header.match(/class="mobile-header-menu"/g)||[]).length,1,page);
  assert.match(header,/mobile-header-panel[\s\S]*?href="bookings.html"/,page);
  assert.match(html,/mobile-header\.css\?v=20261118-1/,page);
 }
 assert.doesNotMatch(await read('index.html'),/mobile-header\.css|compact-header/);
});
test('requests use a text indicator and mobile layout hides desktop navigation',async()=>{
 const css=await read('mobile-header.css');
 assert.match(css,/\.desktop-header-links,[\s\S]*?display:none!important/);
 assert.match(css,/\.mobile-header-menu:not\(\[open\]\)/);
 assert.match(css,/\.mobile-bottom-nav small[^{]*\{[^}]*text-overflow:clip/);
 const js=await read('js/header-requests.js');
 assert.doesNotMatch(js,/createBell|request-bell/);
 assert.match(js,/request-badge/);
 assert.match(js,/booking_requests/);
});
