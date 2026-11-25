import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {visibilityDraft,nextVisibility,publicationProblem} from '../js/listing-publish.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('visibility is private by default and gender stays optional',()=>{
 const off={published:false,showGender:false};const on={published:true,showGender:false};
 assert.deepEqual(visibilityDraft(null),off);assert.deepEqual(visibilityDraft({published:false,public_gender:'female'}),off);
 assert.deepEqual(visibilityDraft({published:true,public_gender:'female'}),{published:true,showGender:true});
 assert.deepEqual(nextVisibility(off,'gender'),off);assert.deepEqual(nextVisibility(off,'public'),on);
 assert.deepEqual(nextVisibility(on,'gender',false),on);assert.deepEqual(nextVisibility(on,'gender'),{published:true,showGender:true});
 assert.deepEqual(nextVisibility({published:true,showGender:true},'public'),off);
 assert.deepEqual(nextVisibility({published:true,showGender:true},'no-gender'),on);
});
test('publication requires existing safety and profile eligibility',()=>{
 const p={profile_kind:'companion',adult_confirmed:true,boundaries_accepted:true,bio:'A friendly companion for walks.',categories:['coffee'],hourly_rate:100,avatar_path:'builtin:male-1'};
 assert.equal(publicationProblem(p),'');for(const patch of [{adult_confirmed:false},{boundaries_accepted:false},{bio:'short'},{categories:[]},{hourly_rate:0},{avatar_path:null},{profile_kind:'customer'}])assert.ok(publicationProblem({...p,...patch}));
});
test('single explicit save, no dialog or separate update button',async()=>{
 const html=await read('profile.html'),page=await read('js/profile-page.js'),publish=await read('js/listing-publish.js');
 assert.doesNotMatch(html,/id="publish-prompt"|id="update-public-listing"|Ready to go public/);
 assert.match(html,/Turn on Public Profile and save to share/);
 assert.match(page,/await publishing\.prepareSave\(\)/);assert.match(page,/await publishing\.saveVisibility\(data/);
 assert.doesNotMatch(page,/openPublishPrompt|showModal\(/);
 assert.match(publish,/if\(!draft\.published\|\|!\['companion','both'\]\.includes\(p.profile_kind\)\)/);
 assert.match(publish,/publish\.addEventListener\('click',\(\)=>\{if\(!busy&&known&&isCompanion\(\)\)change\('public'\);\}\)/);
});
