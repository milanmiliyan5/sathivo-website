import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recoveryOptions} from '../js/booking-recovery.js';
const now=Date.parse('2026-11-16T12:00:10Z');
const row={id:'booking',status:'completed',customer_id:'customer',companion_id:'companion',completed_by:'companion',completed_at:'2026-11-16T12:00:00Z'};
test('the completion actor has an immediate undo, which expires at 30 seconds',()=>{
 assert.deepEqual(recoveryOptions(row,'companion',now),['undo','request']);
 assert.deepEqual(recoveryOptions(row,'companion',Date.parse('2026-11-16T12:00:30Z')),['request']);
 assert.deepEqual(recoveryOptions(row,'customer',now),['request']);
});
test('only the other participant can respond to a pending reopening',()=>{
 const pending={...row,reopen_request_state:'pending',reopen_requested_by:'customer'};
 assert.deepEqual(recoveryOptions(pending,'customer',now),[]);
 assert.deepEqual(recoveryOptions(pending,'companion',now+30000),['approve','decline']);
 assert.deepEqual(recoveryOptions(pending,'outsider',now),[]);
 assert.deepEqual(recoveryOptions({...pending,reopen_request_state:'declined'},'customer',now),[]);
 assert.deepEqual(recoveryOptions({...row,status:'accepted'},'customer',now),[]);
});
test('both web completion surfaces ask for confirmation and use the same recovery RPC',async()=>{
 for(const name of ['bookings-page','requests-page']){
  const s=await readFile(new URL('../js/'+name+'.js',import.meta.url),'utf8');
  assert.match(s,/await confirmCompletion\(\)/);
  assert.match(s,/appendRecoveryControls\(a,r,user.id,recoverBooking\)/);
 }
 const a=await readFile(new URL('../js/admin-page.js',import.meta.url),'utf8');
 assert.match(a,/runRecovery\(client,b.id,'admin_reopen',reason.trim\(\)\)/);
});
