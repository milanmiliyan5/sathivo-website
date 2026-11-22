import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Card shows verified reviews alongside completed bookings',async()=>{
 const s=await read('js/companions-page.js');assert.match(s,/experienceAndRating\(row\)/);
 assert.match(s,/#ratings-and-reviews/);assert.match(s,/public_companion_review_comments/);
 assert.match(s,/No public written reviews yet/);assert.match(s,/No reviews yet/);
});
test('Only opt-in genuine booking reviews are shared without identities',async()=>{
 const sql=await read('supabase/migrations/20261122190000_review_public_comment_opt_in.sql');
 assert.match(sql,/is_public_comment=true/);assert.match(sql,/b.status='completed'/);
 assert.match(sql,/l.published=true/);assert.doesNotMatch(sql,/returns table\([^)]*reviewer_id/);
});