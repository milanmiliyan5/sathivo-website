import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
test('every public/member page tracks visits, and admin does not',async()=>{
 for(const name of (await readdir(root)).filter(n=>n.endsWith('.html'))){
  const html=await readFile(new URL(name,root),'utf8');
  assert.equal(html.includes('js/site-presence.js'),!['admin.html','email-signature.html'].includes(name),name);
 }
});
test('Presence debounces rapid tab switches and resumes from BFCache safely',async()=>{
 const source=(await readFile(new URL('js/site-presence.js',root),'utf8')).replace(/^import .*\n/,'');
 const win={},doc={},storage=new Map(),timers=new Map();
 let now=Date.UTC(2026,10,22,8,20),timerId=0;
 let tracked=0,untracked=0,removed=0,visits=0;
 const fakeSetTimeout=(callback,ms)=>{
  const id=++timerId;
  timers.set(id,{callback,due:now+ms});
  return id;
 };
 const flush=()=>new Promise(setImmediate);
 async function tick(ms){
  now+=ms;
  for(let i=0;i<16;i++){
   const due=[...timers.entries()].filter(([,timer])=>timer.due<=now)
    .sort((a,b)=>a[1].due-b[1].due);
   if(!due.length)return;
   const [id,timer]=due[0];
   timers.delete(id);
   timer.callback();
   await flush();
  }
  throw Error('Unexpected retry loop in Presence timers');
 }
 class FakeDate extends Date{
  constructor(...args){super(...(args.length?args:[now]));}
  static now(){return now;}
 }
 const channel={
  subscribe(fn){fn('SUBSCRIBED');return this},
  async track(){tracked++;return 'ok'},
  async untrack(){untracked++;return 'ok'}
 };
 const document={visibilityState:'visible',addEventListener:(name,fn)=>{doc[name]=fn}};
 const context=vm.createContext({
  Date:FakeDate,setTimeout:fakeSetTimeout,clearTimeout:id=>timers.delete(id),
  document,window:{addEventListener:(name,fn)=>{win[name]=fn}},
  location:{pathname:'/booking-guide.html'},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
  getSathivoPublicClient:async()=>({
   channel:()=>channel,removeChannel:async()=>{removed++},
   functions:{invoke:async()=>{visits++;return {error:null}}}
  })
 });
 vm.runInContext(source,context);
 await flush();
 assert.equal(tracked,1);
 assert.equal(visits,1);
 // A rapid hide/show must neither untrack nor send a redundant track.
 document.visibilityState='hidden';doc.visibilitychange();
 document.visibilityState='visible';doc.visibilitychange();
 await flush();
 assert.equal(untracked,0);
 assert.equal(tracked,1);
 // After 9s in the background, leave Presence once.
 document.visibilityState='hidden';doc.visibilitychange();
 await tick(9000);
 assert.equal(untracked,1);
 document.visibilityState='visible';doc.visibilitychange();
 await flush();
 assert.equal(tracked,2);
 assert.equal(visits,1);
 // BFCache leaves immediately, but returning is deferred once budget is spent.
 document.visibilityState='hidden';win.pagehide({persisted:true});
 await flush();
 assert.equal(untracked,2);
 assert.equal(removed,0);
 document.visibilityState='visible';win.pageshow({persisted:true});
 await flush();
 assert.equal(tracked,2);
 await tick(31000);
 assert.equal(tracked,3);
 assert.equal(visits,1);
 win.pagehide({persisted:false});
 assert.equal(removed,1);
});
