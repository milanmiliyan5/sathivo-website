import {assertVersionedAsset} from './versioned-asset.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('only completed bookings count as companion experience',async()=>{
 const db=await read('supabase/migrations/20261122174000_public_companion_completed_booking_badges.sql');
 assert.match(db,/b.status = 'completed'/);
 assert.match(db,/l.published is true/);
 assert.match(db,/l.moderation_status = 'active'/);
 assert.match(db,/cardinality\(p_public_ids\), 0\) between 1 and 100/);
 assert.match(db,/revoke all on function public.public_companion_completed_counts\(uuid\[\]\) from public/);
 assert.doesNotMatch(db,/create\s+policy/i);
});
test('Explore and public companion profile show counts via read-only RPC',async()=>{
 const code=await read('js/companions-page.js');
 assert.match(code,/rpc\('public_companion_completed_counts',\{p_public_ids:ids\}\)/);
 assert.match(code,/count===0\?'Newly Joined':count\+' Booking'/);
 assert.match(code,/await withCompletedCounts\(all.slice\(0,24\)\)/);
 assert.match(code,/await withCompletedCounts\(\[r\]\)/);
 assert.match(code,/if\(raw===null\|\|raw===undefined\)return null/);
 assert.doesNotMatch(code,/from\('booking_requests'\)\.select\(/);
 const list=await read('companions.html');
 const profile=await read('companion.html');
 for(const html of [list,profile]){
  assertVersionedAsset(html, 'js/companions-page.js', '20261127');
  assert.match(html,/companions\.css\?v=[a-z0-9.-]+/i);
 }
});
