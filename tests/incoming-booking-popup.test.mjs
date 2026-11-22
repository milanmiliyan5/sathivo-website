import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('incoming reminders use pending bookings and secure per-booking suppression only',async()=>{
 const js=await read('js/incoming-booking-popup.js');
 assert.match(js,/eq\('companion_id',user\.id\)\.eq\('status','pending'\)/);
 assert.match(js,/from\('incoming_booking_popup_dismissals'\)/);
 assert.match(js,/insert\(\{user_id:user\.id,booking_id:b\.id\}\)/);
 assert.doesNotMatch(js,/from\('booking_requests'\)[\s\S]{0,110}\.update\(/);
 assert.match(js,/pointermove/);
 assert.match(js,/showModal/);
 assert.match(js,/sessionStorage/);
 assert.match(js,/setTimeout\(\(\)=>void maybeOpen\(client\),4000\)/);
 assert.doesNotMatch(js,/maybeOpen\(client\),1200|maybeOpen\(client\),1600/);
});
test('all main app pages include the incoming popup through notification boot',async()=>{
 const header=await read('js/header-notifications.js');
 assert.match(header,/incoming-booking-popup\.js/);
 for(const path of ['index','account','companions','companion','bookings','requests','chats','chat','notifications','profile']){
  const html=await read(path+'.html');
  assert.match(html,/header-notifications\.js\?v=20261122-incoming-4sec/);
 }
});
