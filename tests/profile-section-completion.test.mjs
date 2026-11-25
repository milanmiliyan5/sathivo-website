import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileSectionCompletion,savedProfileTicks,nextProfileStage,stageAfterSave} from '../js/profile-section-completion.js';
const saved={profile_kind:'companion',display_name:'Test Member',gender:'prefer_not_to_say',location_id:1,city_name:'City',languages:'Hindi',avatar_path:'builtin:male-1',bio:'A friendly companion for walks.',categories:['coffee','movies'],meeting_mode:'both',hourly_rate:200,adult_confirmed:true,boundaries_accepted:true};
const all={personal:true,companion:true,privacy:true};
test('saved complete sections display independent ticks, including existing users',()=>{
 assert.deepEqual(profileSectionCompletion(saved,{...saved,location_id:'1',hourly_rate:'200',categories:['movies','coffee']}),all);
 assert.deepEqual(profileSectionCompletion(null,saved),{personal:false,companion:false,privacy:false});
});
test('draft validation detects unsaved edits without changing saved indicators',()=>{
 assert.deepEqual(profileSectionCompletion(saved,{...saved,display_name:'Changed'}),{...all,personal:false});
 assert.deepEqual(profileSectionCompletion(saved,saved,{pendingPhoto:true}),{...all,personal:false});
 assert.deepEqual(profileSectionCompletion(saved,{...saved,hourly_rate:300}),{...all,companion:false});
 assert.deepEqual(profileSectionCompletion(saved,{...saved,adult_confirmed:false}),{...all,privacy:false});
 const missing={...saved,categories:[]};assert.equal(profileSectionCompletion(missing,missing).companion,false);
 const noBio={...saved,bio:''};assert.equal(profileSectionCompletion(noBio,noBio).personal,false);
 const invalidRate={...saved,hourly_rate:100001};assert.equal(profileSectionCompletion(invalidRate,invalidRate).companion,false);
});
test('customer-only profile does not need companion details or public consent',()=>{
 const customer={...saved,profile_kind:'customer',avatar_path:null,bio:'',categories:[],hourly_rate:null};
 assert.deepEqual(profileSectionCompletion(customer,customer),{personal:true,companion:false,privacy:true});
});
test('three indicators start hidden and use confirmed save/load state only',async()=>{
 const html=await readFile(new URL('../profile.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../js/profile-page.js',import.meta.url),'utf8');
 assert.equal((html.match(/class="profile-section-tick"/g)||[]).length,3);
 assert.match(js,/savedSectionProfile=p\?\{\.\.\.p\}:null/);
  assert.match(js,/savedSectionProfile=\{\.\.\.data\};privateSaved=true/);
 assert.match(js,/toggleAttribute\('hidden',!done\)/);
});

test('saved indicators are independent from edits, switches and navigation',()=>{
 const persisted={...saved,setup_stage:'complete'};
 const draft={...persisted,display_name:'Unsaved name',hourly_rate:'300',adult_confirmed:false};
 assert.equal(profileSectionCompletion(persisted,draft).personal,false);
 assert.deepEqual(savedProfileTicks(persisted),all);
 assert.deepEqual(savedProfileTicks({...persisted}),all);
 assert.deepEqual(savedProfileTicks(saved),all);
 assert.deepEqual(savedProfileTicks(null),{personal:false,companion:false,privacy:false});
});
test('published or hidden existing listings recover privacy tick after old stage regression',()=>{
 for(const stage of ['companion','privacy']){
  const existing={...saved,setup_stage:stage};
  assert.equal(savedProfileTicks(existing).privacy,false);
  assert.deepEqual(savedProfileTicks(existing,{hasListing:true}),all);
  assert.equal(nextProfileStage(existing,{hasListing:true}),'personal');
  assert.equal(stageAfterSave('personal','companion',{saved:existing,hasListing:true}),'companion');
 }
});
test('new onboarding needs its final save; completed private profiles retain completion',()=>{
 const personal={...saved,categories:[],hourly_rate:null,setup_stage:'companion'};
 assert.deepEqual(savedProfileTicks(personal),{personal:true,companion:false,privacy:false});
 assert.deepEqual(savedProfileTicks({...saved,setup_stage:'privacy'}),{personal:true,companion:true,privacy:false});
 for(const existing of [saved,{...saved,setup_stage:'complete'}]){
  assert.equal(stageAfterSave('personal','companion',{saved:existing}), 'complete');
  assert.equal(stageAfterSave('companion','companion',{saved:existing}), 'complete');
 }
 assert.equal(stageAfterSave('companion','companion',{saved:personal}),'privacy');
});
test('render uses persisted ticks rather than the current draft or pending switches',async()=>{
 const js=await readFile(new URL('../js/profile-page.js',import.meta.url),'utf8');
 const render=js.slice(js.indexOf('function updateSectionTicks()'),js.indexOf('function updateCompleteness()'));
 assert.match(render,/savedProfileTicks\(savedSectionProfile/);
 assert.doesNotMatch(render,/currentCompletion\(|hasPendingChanges\(/);
 assert.match(js,/const done=currentCompletion\(\)/);
});
