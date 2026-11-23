import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('mandatory warning is per account, requires consent and is not dismissible',async()=>{
 const s=await read('js/policy-warning-gate.js');
 assert.match(s,/account_policy_warnings/);
 assert.match(s,/\.eq\('user_id',user\.id\)\.is\('acknowledged_at',null\)/);
 assert.match(s,/event\.preventDefault\(\)|e=>e\.preventDefault\(\)/);
 assert.match(s,/\.showModal\(\)/);
 assert.match(s,/p_agreed:true/);
 assert.match(s,/\.disabled=!tick\.checked/);
 assert.match(s,/Sign out/);assert.match(s,/support\.html/);assert.match(s,/delete-account\.html/);
 assert.doesNotMatch(s,/localStorage/);
});
test('write permissions are guarded in database while acknowledgment is owner-only',async()=>{
 const sql=await read('supabase/migrations/20261124001000_mandatory_policy_warning_gate.sql');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/where id=p_warning_id and user_id=v_uid and acknowledged_at is null/);
 assert.match(sql,/revoke all on public\.account_policy_warnings from public,anon,authenticated/);
 for(const table of ['booking_requests','booking_messages','member_profiles','companion_listings','booking_reviews','companion_favorites'])
  assert.ok(sql.includes("'"+table+"'"),table);
});
test('warning gate is available on major logged-in routes and admin reports display acknowledgment state',async()=>{
 for(const page of ['index.html','account.html','companions.html','companion.html','profile.html','bookings.html','requests.html','chats.html','chat.html','notifications.html']){
  assert.match(await read(page),/js\/policy-warning-gate\.js\?v=20261124-1/);
 }
 assert.match(await read('js/admin-page.js'),/account_policy_warnings/);
 assert.match(await read('js/admin-page.js'),/Pending acknowledgment/);
 assert.match(await read('js/admin-page.js'),/Acknowledged/);
});
