import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileSectionCompletion} from '../js/profile-section-completion.js';
const saved={profile_kind:'companion',display_name:'Test Member',gender:'prefer_not_to_say',location_id:1,city_name:'City',languages:'Hindi',avatar_path:'builtin:male-1',bio:'A friendly companion for walks.',categories:['coffee','movies'],meeting_mode:'both',hourly_rate:200,adult_confirmed:true,boundaries_accepted:true};
const all={personal:true,companion:true,privacy:true};
test('saved complete sections display independent ticks, including existing users',()=>{
 assert.deepEqual(profileSectionCompletion(saved,{...saved,location_id:'1',hourly_rate:'200',categories:['movies','coffee']}),all);
 assert.deepEqual(profileSectionCompletion(null,saved),{personal:false,companion:false,privacy:false});
});
test('unsaved or incomplete sections lose only their own tick',()=>{
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
 assert.match(js,/if\(error\|\|!data\)throw Error\('Profile could not be saved[^']*'\);\s*savedSectionProfile=\{\.\.\.row\}/);
 assert.match(js,/toggleAttribute\('hidden',!done\)/);
});
