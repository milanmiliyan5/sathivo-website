import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('all tabs use static shared CSS loaded last and cache-busted JS',async()=>{
 const pages=['index.html','account.html','companions.html','companion.html','profile.html','bookings.html','requests.html','chats.html','notifications.html'];
 for(const p of pages){
  const h=await read(p);
  assert.match(h,/mobile-nav-clean\.css\?v=20261124-2/);
  assert.match(h,/js\/mobile-nav\.js\?v=20261124-clean-nav-2/);
  assert.equal((h.match(/mobile-nav-clean\.css\?v=20261124-2/g)||[]).length,1,p);
  assert.ok(h.lastIndexOf('mobile-nav-clean.css')>h.lastIndexOf('site-2d.css'),p+' styles must load after theme');
 }
 const js=await read('js/mobile-nav.js');
 assert.match(js,/ensureMobileNavStyles/);
 assert.match(js,/link\[href\*="mobile-nav-clean.css"\]/);
});
