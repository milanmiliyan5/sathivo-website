import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('compact thanks is account-scoped, confirms action, and persists X or Continue',async()=>{
 const js=await read('js/safety-thanks-popup.js');
 assert.match(js,/safety_report_thanks/);
 assert.match(js,/\.eq\('user_id',user\.id\)\.is\('seen_at',null\)/);
 assert.match(js,/getUser\(\)/);
 assert.match(js,/Thank You, /);
 assert.match(js,/formal warning/);
 assert.match(js,/permanent account removal/);
 assert.match(js,/Your safety matters/);
 assert.match(js,/Thank You &amp; Continue/);
 assert.match(js,/sathivo_acknowledge_safety_thanks/);
 assert.match(js,/x\.addEventListener\('click',\(\)=>void acknowledge\(\)\)/);
 assert.doesNotMatch(js,/localStorage|sessionStorage/);
});
test('DB acknowledgement is owner-only, with no client direct writes',async()=>{
 const sql=await read('supabase/migrations/20261124001001_one_time_safety_thanks.sql');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/where id=p_notice_id and user_id=v_uid and seen_at is null/);
 assert.match(sql,/revoke all on public\.safety_report_thanks from public,anon,authenticated/);
 assert.match(sql,/grant select on public\.safety_report_thanks to authenticated/);
});
test('every major signed-in site page includes thank-you UI and preserves warning',async()=>{
 for(const p of ['index.html','account.html','companions.html','companion.html','profile.html','bookings.html','requests.html','chats.html','chat.html','notifications.html']){
  const s=await read(p);
  assert.match(s,/js\/safety-thanks-popup\.js\?v=20261124-thanks-1/);
  assert.match(s,/safety-thanks-popup\.css\?v=20261124-thanks-1/);
  assert.match(s,/js\/policy-warning-gate\.js\?v=20261124-1/);
 }
});
