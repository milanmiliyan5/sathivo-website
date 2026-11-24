import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('mobile nav keeps all five tabs and live counts',async()=>{
 const js=await read('js/mobile-nav.js');
 for(const label of ['Home','Explore','Requests','Chats','Account'])assert.ok(js.includes("'"+label+"'"));
 assert.match(js,/aria-current/);
 assert.match(js,/get_unread_chat_count/);
 assert.match(js,/mobile-nav-badge/);
 assert.match(js,/ensureMobileNavStyles/);
 assert.match(js,/mobile-nav-clean\.css\?v=20261124-1/);
});
test('new CSS removes thick borders and raised active tabs',async()=>{
 const css=await read('mobile-nav-clean.css');
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/\.mobile-bottom-nav::before\{display:none;content:none\}/);
 assert.match(css,/box-shadow:none;transform:none/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(await read('index.html'),/js\/mobile-nav\.js\?v=20261124-clean-nav-2/);
});
