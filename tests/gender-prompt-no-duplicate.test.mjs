import {assertVersionedAsset} from './versioned-asset.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('publishing does not duplicate an already recorded gender response',async()=>{
 const code=await read('js/listing-publish.js');
 assert.match(code,/from\('companion_gender_prompt_responses'\)\.upsert\(/);
 assert.match(code,/onConflict:'user_id',ignoreDuplicates:true/);
 assert.doesNotMatch(code,/from\('companion_gender_prompt_responses'\)\.insert\(/);
 assertVersionedAsset(await read('js/profile-page.js'), './listing-publish.js', '20261125');
 assertVersionedAsset(await read('profile.html'), 'js/profile-page.js', '20261125');
});
