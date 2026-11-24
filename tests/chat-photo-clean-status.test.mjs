import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../js/chat-page.js',import.meta.url),'utf8');
const photoFunctions=source.slice(source.indexOf('function clearPhotoDraft(){'),source.indexOf('async function report(){'));
function setup(once,failAt){
 const nodes={
  'photo-status':{textContent:'',innerHTML:''},
  'photo-input':{value:''},'photo-draft':{hidden:true},'photo-draft-image':{removeAttribute(){}},
  'view-once':{checked:false},message:{value:'',maxLength:2000}
 };
 // Model DOM replacement semantics: clearing textContent also clears spinner markup.
 Object.defineProperty(nodes['photo-status'],'textContent',{get(){return this.innerHTML},set(value){this.innerHTML=value}});
 const calls=[];
 const context=vm.createContext({
  $:id=>nodes[id],selectedPhotoFile:null,selectedPhotoPreviewUrl:null,
  URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},fitComposer(){},
  booking:{id:'booking',status:'accepted'},user:{id:'sender'},crypto:{randomUUID:()=> 'photo'},
  compressImageFile:async(file,options)=>{calls.push({action:'compress',options});return {blob:'compressed-blob',ext:'webp',type:'image/webp',originalBytes:713000,outputBytes:77000}},
  client:{storage:{from:()=>({upload:async(path,blob)=>{calls.push({action:'upload',blob});return failAt==='upload'?{error:true}:{}},remove:async()=>{calls.push({action:'remove'})}})},from:()=>({insert:row=>{calls.push({action:'insert',row});return {select:()=>({single:async()=>failAt==='insert'?{error:true}:{data:{id:'msg'}}})}}})},
  sendMessagePush(){calls.push({action:'push'})}
 });
 vm.runInContext(photoFunctions,context);
 context.stagePhoto({type:'image/jpeg',size:713000});
 nodes['view-once'].checked=once;
 return {context,nodes,calls};
}
for(const once of [false,true]){
 test('Photo compression stays enabled and success status is silent: view once='+once,async()=>{
  const {context,nodes,calls}=setup(once);
  assert.equal(nodes['photo-status'].textContent,'');
  assert.equal(await context.sendStagedPhoto(),true);
  assert.equal(nodes['photo-status'].textContent,'');
  assert.equal(calls[0].action,'compress');
  assert.equal(calls[0].options.maxBytes,480*1024);
  assert.equal(calls[1].blob,'compressed-blob');
  assert.equal(calls[2].row.view_once,once);
  assert.equal(nodes['photo-draft'].hidden,true);
 });
}
for(const failure of ['upload','insert']){
 test('Photo failure feedback remains visible: '+failure,async()=>{
  const {context,nodes,calls}=setup(false,failure);
  assert.equal(await context.sendStagedPhoto(),false);
  assert.match(nodes['photo-status'].textContent,/failed.*retry/i);
  if(failure==='insert')assert.ok(calls.some(c=>c.action==='remove'));
 });
}
test('Photo composer no longer exposes technical compression sizes',()=>{
 assert.doesNotMatch(photoFunctions,/formatBytes|originalBytes|outputBytes|Sending compressed photo|Photo sent\.|View-once photo sent\./);
 assert.match(photoFunctions,/Preparing photo/);
 assert.match(photoFunctions,/Sending photo/);
});
