import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Support photo notice is owner scoped, persisted and never emails or broadcasts',async()=>{
 const s=await read('js/support-photo-popup.js');
 assert.match(s,/\.eq\('user_id',user\.id\)\.eq\('campaign_key',campaign\)\.is\('read_at',null\)/);
 assert.match(s,/update\(\{read_at:new Date\(\)\.toISOString\(\)\}\)/);
 assert.match(s,/identity\.data\?\.user\?\.id!==user\.id/);
 assert.match(s,/schedule\(ms=3000\)/);
 assert.match(s,/acknowledge\(true\)/);
 assert.match(s,/acknowledge\(false\)/);
 assert.match(s,/profile\.html#companion-photo-section/);
 assert.doesNotMatch(s,/sendEmail|functions\.invoke|localStorage|sessionStorage/);
});
test('Support notice is included on entry pages and photo link opens Personal section',async()=>{
 for(const p of ["index.html","account.html","companions.html","companion.html","profile.html","bookings.html","requests.html","chats.html","chat.html","notifications.html"])assert.match(await read(p),/js\/support-photo-popup\.js\?v=20261126-1/);
 const s=await read('js/profile-page.js');
 assert.match(s,/location\.hash!==\x27#companion-photo-section\x27/);
 assert.match(s,/showProfileTab\('personal',\{record:false\}\);profileScroll\.cancel\(\)/);
 assert.match(s,/section\?\.scrollIntoView/);
});
