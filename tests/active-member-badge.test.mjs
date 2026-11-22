import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('public directory and detail render Active Member only when public API confirms it',async()=>{
 const script=await read('js/companions-page.js');
 assert.match(script,/publicClient\.rpc\('public_active_member_badges',\{p_public_ids:ids\}\)/);
 assert.match(script,/is_active_member:recognized\.has\(row\.public_id\)/);
 assert.match(script,/if\(row\.is_active_member!==true\)return null/);
 assert.match(script,/heading\.append\(document\.createTextNode\(' '\),activity\)/);
 assert.match(script,/const all=data\\|\\|\\[\\],rows=await withCompletedCounts\\(all\\.slice\\(0,24\\)\\)/);
 assert.match(script,/const \\[current\\]=await withCompletedCounts\\(\\[r\\]\\)/);
 assert.match(script,/Not identity or safety verification/);
 assert.doesNotMatch(script,/\b(?:Gold|Silver|Bronze)\b.*badge/);
});
test('badge is included on both cards and opened profiles, plus member own profile',async()=>{
 for(const path of ['companions.html','companion.html','profile.html']){
  const html=await read(path);
  assert.match(html,/active-member\.css\?v=20261122-active-1/);
 }
 const profile=await read('profile.html');
 const own=await read('js/profile-page.js');
 assert.match(profile,/id="active-member-own-badge"/);
 assert.match(own,/from\('active_member_badges'\)\.select\('user_id'\)\.eq\('user_id',user\.id\)/);
 assert.match(own,/\$\('active-member-own-badge'\)\.hidden=!!activeBadge\.error\|\|!activeBadge\.data/);
 const css=await read('active-member.css');
 assert.match(css,/\.active-member-badge\{/);
 assert.match(css,/max-width:560px/);
 assert.match(css,/\[hidden\]\{display:none!important\}/);
});
test('server-side badges do not grant identity verification or expose private chat counts',async()=>{
 const sql=await read('supabase/migrations/20261122173457_manual_active_member_profile_badges.sql');
 assert.match(sql,/references auth\.users\(id\) on delete cascade/);
 assert.match(sql,/alter table public\.active_member_badges enable row level security/);
 assert.match(sql,/revoke all on table public\.active_member_badges from public, anon, authenticated/);
 assert.match(sql,/grant select on table public\.active_member_badges to anon, authenticated/);
 assert.match(sql,/language sql stable security invoker/);
 assert.match(sql,/l\.published and l\.moderation_status='active'/);
 assert.match(sql,/cardinality\(p_public_ids\) between 1 and 100/);
 assert.match(sql,/grant execute on function public\.public_active_member_badges\(uuid\[\]\) to anon, authenticated/);
 assert.doesNotMatch(sql,/booking_messages|message_count|email|payment/);
});
