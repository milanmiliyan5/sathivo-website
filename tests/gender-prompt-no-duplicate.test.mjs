import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('publishing does not duplicate an already recorded gender response',async()=>{
 const code=await read('js/listing-publish.js');
 assert.match(code,/from\('companion_gender_prompt_responses'\)\.upsert\(/);
 assert.match(code,/onConflict:'user_id',ignoreDuplicates:true/);
 assert.doesNotMatch(code,/from\('companion_gender_prompt_responses'\)\.insert\(/);
 assert.match(await read('js/profile-page.js'),/listing-publish\.js\?v=20261123-nearby-1/);
 assert.match(await read('profile.html'),/profile-page\.js\?v=20261123-nearby-1/);
});
