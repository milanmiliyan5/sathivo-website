import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {visibilityDraft,nextVisibility,publicationProblem,setupPublishing} from '../js/listing-publish.js';
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
 assert.match(page,/await publishing\.prepareSave\(/);assert.match(page,/await publishing\.saveVisibility\(data/);
 assert.doesNotMatch(page,/openPublishPrompt|showModal\(/);
 assert.match(publish,/if\(!draft\.published\|\|!\['companion','both'\]\.includes\(p.profile_kind\)\)/);
 assert.match(publish,/publish\.addEventListener\('click',\(\)=>\{if\(!busy&&known&&isCompanion\(\)\)change\('public'\);\}\)/);
});

test('switch clicks never write, save publishes/hides, and stale visibility is rejected',async()=>{
 const original=globalThis.document;
 const nodes=new Map();
 function node(id){if(!nodes.has(id))nodes.set(id,{dataset:{},attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this[k];},addEventListener(k,fn){this.listeners[k]=fn;}});return nodes.get(id);}
 globalThis.document={getElementById:node};
 let listing=null,writes=[],pushes=0;
 const client={
  from(table){
   let action='select',payload;
   const chain={
    select(){return chain;},eq(){return chain;},
    update(v){action='update';payload=v;return chain;},
    upsert(v){action='upsert';payload=v;writes.push({table,action,payload});return chain;},
    async maybeSingle(){return {data:listing?{...listing}:null,error:null};},
    async single(){
     if(action==='update'){writes.push({table,action,payload});listing={...listing,...payload};}
     if(action==='upsert'&&table==='companion_listings')listing={...listing,...payload,public_id:'test-id',moderation_status:'active'};
     return {data:{public_id:'test-id'},error:null};
    }
   };return chain;
  },
  functions:{invoke:async()=>{pushes++;}},
  storage:{from(){throw Error('No storage writes expected for unchanged built-in avatar');}}
 };
 const p={profile_kind:'companion',adult_confirmed:true,boundaries_accepted:true,bio:'A friendly companion for walks.',categories:['coffee'],hourly_rate:100,avatar_path:'builtin:male-1',gender:'male'};
 try{
  const pub=await setupPublishing({client,user:{id:'test-user'},onDraftChange(){},isCompanion:()=>true,canShowGender:()=>true});
  assert.equal(pub.selection().published,false);
  await pub.prepareSave();
  assert.equal((await pub.saveVisibility(p)).published,false);
  assert.equal(writes.length,0);
  node('publish-listing').listeners.click();
  node('public-gender-consent').listeners.click();
  assert.equal(writes.length,0);
  await pub.prepareSave();
  assert.equal((await pub.saveVisibility(p)).published,true);
  assert.equal(listing.public_gender,'male');assert.equal(pushes,1);
  const before=writes.length;
  await pub.prepareSave();
  await pub.saveVisibility({...p,bio:'A changed and longer biography.'});
  assert.equal(writes.slice(before).some(x=>x.action==='update'&&x.payload.published===false),false);
  assert.equal(pushes,1);
  node('publish-listing').listeners.click();
  assert.equal(listing.published,true);
  await pub.prepareSave();
  assert.equal((await pub.saveVisibility(p)).published,false);
  assert.equal(listing.public_gender,null);
  listing={...listing,published:true,public_gender:null};
  await assert.rejects(pub.prepareSave(),/Visibility changed in another session/);
  assert.equal(pub.selection().published,true);
 }finally{globalThis.document=original;}
});
