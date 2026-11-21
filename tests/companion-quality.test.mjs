import test from 'node:test';
import assert from 'node:assert/strict';
import {assessListingQuality,duplicateBioCounts,summarizeListingQuality} from '../js/companion-quality.js';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const good={user_id:'1',published:true,moderation_status:'active',display_name:'Aditi',bio:'I like discussing books and visiting busy cafes during the afternoon. I speak Hindi and English, and prefer strictly platonic plans.',languages:'Hindi, English',interests:'Books, coffee',availability:'Afternoons',city_name:'Berhampur',location_id:1,categories:['coffee'],hourly_rate:250,photo_path:'assets/avatar-female-1.webp'};
test('complete real-world descriptions are not flagged',()=>{
 const r=assessListingQuality(good,duplicateBioCounts([good]));
 assert.equal(r.needsReview,false);assert.equal(r.policyReview,false);
});
test('advisory flags are specific and never change stored profile data',()=>{
 const draft={...good,user_id:'2',bio:'Hi, message me on WhatsApp',languages:'',interests:''};
 const before=structuredClone(draft);
 const r=assessListingQuality(draft);
 assert.equal(r.needsReview,true);assert.equal(r.policyReview,true);
 assert.ok(r.flags.some(x=>x.startsWith('Short bio')));
 assert.ok(r.flags.some(x=>x.startsWith('Languages')));
 assert.deepEqual(draft,before);
});
test('only currently public active listings affect quality counts',()=>{
 const repeated='I enjoy platonic coffee chats and local bookshops on quiet afternoons in public places.';
 const one={...good,bio:repeated},two={...good,user_id:'2',bio:repeated};
 const hidden={...good,user_id:'3',published:false,bio:'x'};
 const suspended={...good,user_id:'4',moderation_status:'suspended',bio:'x'};
 const result=summarizeListingQuality([one,two,hidden,suspended]);
 assert.equal(result.total,2);assert.equal(result.repeatedBios,2);
 assert.equal(result.flagged,2);
 assert.deepEqual(assessListingQuality(hidden,result.duplicates).flags,[]);
});
test('quality controls stay admin-only and never auto-suspend users',async()=>{
 const admin=await read('admin.html'),script=await read('js/admin-page.js');
 assert.match(admin,/id="listing-quality-filter"/);
 assert.match(admin,/id="listing-quality-summary"/);
 assert.match(script,/summarizeListingQuality/);
 assert.match(script,/assessListingQuality/);
 assert.doesNotMatch(script,/quality.{0,60}update\(\{moderation_status/i);
 assert.match(admin,/no automatic suspension/i);
});
test('public listing instructions explain authentic profile details',async()=>{
 const profile=await read('profile.html');
 assert.match(profile,/Quality checklist before publishing/i);
 assert.match(profile,/Do not include phone numbers/i);
 const directory=await read('companions.html');
 assert.match(directory,/What a useful public profile should tell you/i);
});
