import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('owner controls protected, audited and enforced on new actions',async()=>{
 const sql=await read('supabase/migrations/20261126034547_founder_controls_phase_one.sql');
 assert.match(sql,/founder_controls enable row level security/);assert.match(sql,/founder_audit enable row level security/);
 assert.match(sql,/grant update\(enabled\)/);assert.match(sql,/a\.role='owner'/);
 assert.match(sql,/before insert on public\.booking_requests/);assert.match(sql,/before insert on public\.booking_messages/);
 assert.match(sql,/insert into public\.founder_audit/);assert.match(sql,/not enabled/);
});
test('founder controls are manual, confirmed, and real database updates',async()=>{
 const [html,js,module]=await Promise.all([read('admin.html'),read('js/admin-page.js'),read('js/founder-controls.js')]);
 assert.match(html,/id="founder-section" hidden/);assert.match(js,/a\.data\.role==='owner'/);
 assert.match(module,/from\('founder_controls'\)\.update/);assert.match(module,/window\.confirm/);
 assert.match(module,/from\('founder_audit'\)/);assert.doesNotMatch(module,/setInterval|setTimeout/);
 assert.match(js,/showUserDetails/);assert.match(js,/renderIssueSummary/);
});
