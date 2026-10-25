import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the page's real update handler without an account or a live booking.
const source=await readFile(new URL('../js/requests-page.js',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('async function update(id,status,extra={})'),source.indexOf('\nasync function markLinkedNotification'));
for(const failure of ['provider error','network rejection']){
 test('request controls recover from '+failure,async()=>{
  const buttons=[{disabled:true},{disabled:true}],attrs=new Map(),classes=new Set(['request-accepting']);
  const card={dataset:{},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),querySelectorAll:()=>buttons,classList:{remove:k=>classes.delete(k)}};
  const status={textContent:''};let calls=0;
  const context=vm.createContext({document:{getElementById:()=>card},$:()=>status,
   client:{from:()=>({update:()=>({eq:async()=>{calls++;if(failure==='network rejection')throw Error('offline');return {error:{message:'failed'}};}})})}});
  vm.runInContext(handler,context);
  await context.update('test-id','accepted');
  assert.equal(buttons.every(b=>!b.disabled),true);
  assert.equal(attrs.has('aria-busy'),false);
  assert.equal(classes.has('request-accepting'),false);
  assert.equal(card.dataset.updating,undefined);
  assert.match(status.textContent,/try again/i);
  await context.update('test-id','accepted');
  assert.equal(calls,2,'a failed action can be retried');
 });
}
test('an in-flight request cannot be submitted twice',async()=>{
 let calls=0,finish;
 const card={dataset:{},setAttribute(){},removeAttribute(){},querySelectorAll:()=>[],classList:{remove(){}}};
 const context=vm.createContext({document:{getElementById:()=>card},$:()=>({textContent:''}),
  client:{from:()=>({update:()=>({eq:()=>{calls++;return new Promise(resolve=>{finish=resolve})}})})}});
 vm.runInContext(handler,context);
 const first=context.update('test-id','accepted');
 await context.update('test-id','accepted');
 assert.equal(calls,1);
 finish({error:{message:'retry'}});await first;
 assert.equal(card.dataset.updating,undefined);
});
