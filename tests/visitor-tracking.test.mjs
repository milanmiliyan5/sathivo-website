import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
test('every public/member page tracks visits, and admin does not',async()=>{
 for(const name of (await readdir(root)).filter(n=>n.endsWith('.html'))){
  const html=await readFile(new URL(name,root),'utf8');
  assert.equal(html.includes('js/site-presence.js'),name!=='admin.html',name);
 }
});
test('presence resumes after Back and hidden tabs leave without duplicating visits',async()=>{
 const source=(await readFile(new URL('js/site-presence.js',root),'utf8')).replace(/^import .*\n/,'');
 const win={},doc={},storage=new Map();let tracked=0,untracked=0,removed=0,visits=0;
 const channel={subscribe(fn){fn('SUBSCRIBED');return this},async track(){tracked++},async untrack(){untracked++}};
 const document={visibilityState:'visible',addEventListener:(n,fn)=>doc[n]=fn};
 const context=vm.createContext({document,window:{addEventListener:(n,fn)=>win[n]=fn},location:{pathname:'/booking-guide.html'},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
  getSathivoPublicClient:async()=>({channel:()=>channel,removeChannel:async()=>removed++,functions:{invoke:async()=>{visits++;return {error:null}}}})});
 vm.runInContext(source,context);await new Promise(setImmediate);
 assert.equal(tracked,1);assert.equal(visits,1);
 document.visibilityState='hidden';doc.visibilitychange();assert.equal(untracked,1);
 document.visibilityState='visible';doc.visibilitychange();await new Promise(setImmediate);
 assert.equal(tracked,2);assert.equal(visits,1);
 win.pagehide({persisted:true});assert.equal(removed,0);
 win.pageshow({persisted:true});await new Promise(setImmediate);assert.equal(tracked,3);assert.equal(visits,1);
 win.pagehide({persisted:false});assert.equal(removed,1);
});
