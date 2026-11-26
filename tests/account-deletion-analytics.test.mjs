import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {csvCell} from '../js/admin-deletions.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('optional reason, feedback disclosure and post-success server event',async()=>{
 const html=await read('delete-account.html'),js=await read('js/delete-account-page.js'),edge=await read('supabase/functions/delete-my-account/index.ts');
 assert.match(html,/id="delete-reason"/);assert.match(html,/id="delete-feedback" maxlength="500"/);assert.doesNotMatch(html,/id="delete-reason"[^>]*required/);
 assert.match(js,/reason:\$\('delete-reason'\)\.value/);
 assert.ok(edge.indexOf('if (deleteError) throw deleteError;')<edge.indexOf('from("account_deletion_events").insert'));
 const insert=edge.split('from("account_deletion_events").insert')[1].split('});')[0];assert.doesNotMatch(insert,/user_id|email|display_name/);
});
test('owner-only database analytics and safe CSV',async()=>{
 const s=await read('supabase/migrations/20261126091135_account_deletion_analytics.sql');assert.match(s,/enable row level security/);assert.match(s,/a.role='owner'/);assert.match(s,/revoke all/);assert.doesNotMatch(s,/user_id uuid/);
 assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('hello "world"'),'"hello ""world"""');
});
test('dashboard owner analytics wired into manual refresh',async()=>{
 assert.match(await read('admin.html'),/id="deletions-section" hidden/);assert.match(await read('js/admin-page.js'),/refreshDeletions\(client\)/);
 assert.match(await read('js/admin-deletions.js'),/account_deletion_events/);
});
