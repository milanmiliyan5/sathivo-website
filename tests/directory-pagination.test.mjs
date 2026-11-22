import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
async function harness({reduced=false}={}){
 const source=await read('js/companions-page.js');
 const fragment=source.slice(source.indexOf('function scrollToDirectoryResults('),source.indexOf('function bookingForm('));
 const calls=[],pending=[],nodes={};
 const $=id=>nodes[id]??=( {value:'',checked:false,replaceChildren(...children){this.children=children},focus(options){calls.push({id,focus:options})},scrollIntoView(options){calls.push({id,scroll:options,rendered:this.children?.length})}} );
 const context=vm.createContext({$,window:{matchMedia:()=>({matches:reduced})},request:0,page:1,locationsLoaded:true,currentUser:null,selectedLocationIds:()=>null,selectedCity:()=>'',scopeName:()=>'',sortLabel:()=>'',el:()=>({}),feedNodes:rows=>rows,withCompletedCounts:async rows=>rows,publicClient:{rpc:()=>new Promise(resolve=>pending.push(resolve))}});
 vm.runInContext(fragment,context);
 return {calls,pending,nodes,list:options=>context.list(options)};
}
test('pagination scrolls only after fresh profiles render, with reduced-motion support',async()=>{
 const h=await harness();
 const load=h.list({fromPagination:true});
 assert.equal(h.calls.length,0);
 h.pending.shift()({data:[{},{}]});await load;
 assert.equal(h.calls[0].id,'results');assert.equal(h.calls[0].focus.preventScroll,true);
 assert.equal(h.calls[1].rendered,2);assert.equal(h.calls[1].scroll.block,'start');assert.equal(h.calls[1].scroll.behavior,'smooth');
 const reduced=await harness({reduced:true});
 const next=reduced.list({fromPagination:true});reduced.pending.shift()({data:[{}]});await next;
 assert.equal(reduced.calls[1].scroll.behavior,'instant');
});
test('initial/filter loads do not scroll; stale and failed loads are handled',async()=>{
 const h=await harness();
 const initial=h.list();h.pending.shift()({data:[{}]});await initial;
 assert.equal(h.calls.length,0);
 const old=h.list({fromPagination:true}),fresh=h.list();
 h.pending.shift()({data:[{}]});await old;h.pending.shift()({data:[{}]});await fresh;
 assert.equal(h.calls.length,0);
 const failed=h.list({fromPagination:true});h.pending.shift()({error:Error('network')});await failed;
 assert.equal(h.calls[1].id,'status');
 const empty=h.list({fromPagination:true});h.pending.shift()({data:[]});await empty;
 assert.equal(h.calls[3].id,'status');
});
test('both pagination buttons opt in and directory scroll targets are focusable',async()=>{
 const source=await read('js/companions-page.js');
 assert.match(source,/page--;void list\(\{fromPagination:true\}\)/);
 assert.match(source,/page\+\+;void list\(\{fromPagination:true\}\)/);
 const html=await read('companions.html');
 assert.match(html,/id="results" tabindex="-1"/);
 assert.match(html,/id="status" tabindex="-1"/);
 for(const page of ['companions.html','companion.html'])assert.match(await read(page),/companions-page\.js\?v=20261122-reviews-1/);
});
