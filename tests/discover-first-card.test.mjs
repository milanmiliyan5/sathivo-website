import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
async function harness({gender='',sort='discover'}={}){
 const source=await read('js/companions-page.js');
 const fragment=source.slice(source.indexOf('function scrollToDirectoryResults('),source.indexOf('function bookingForm('));
 const calls=[],nodes={};
 const $=id=>nodes[id]??=({value:id==='gender-filter'?gender:id==='sort'?sort:'',checked:false,hidden:true,dataset:{},replaceChildren(){},focus(){},scrollIntoView(){}});
 const rows=Array.from({length:25},(_,i)=>({public_id:'profile-'+i}));
 const context=vm.createContext({$,window:{matchMedia:()=>({matches:true})},savedView:false,request:0,page:0,directoryFilterKey:'',discoverCursors:new Map(),discoverSeed:'0123456789abcdef',locationsLoaded:true,currentUser:null,selectedLocationIds:()=>null,selectedCity:()=>'',scopeName:()=>'',sortLabel:()=>'',el:()=>({}),feedNodes:rows=>rows,withCompletedCounts:async rows=>rows,publicClient:{rpc:async(name,args)=>{calls.push(args);return {data:rows}}}});
 vm.runInContext(fragment,context);return {context,calls};
}
test('mixed discovery pins the rotating first card while keeping cursor pagination',async()=>{
 const {context,calls}=await harness();await context.list();assert.equal(calls[0].p_sort,'discover-first:0123456789abcdef');
 context.page=1;await context.list();assert.equal(calls[1].p_sort,'discover-first:0123456789abcdef:profile-23:profile-0');assert.equal(calls[1].p_offset,0);
});
test('explicit gender and price sorting remain unchanged',async()=>{
 const male=await harness({gender:'male'});await male.context.list();assert.equal(male.calls[0].p_sort,'discover:0123456789abcdef');assert.equal(male.calls[0].p_gender,'male');
 const price=await harness({sort:'price_asc'});await price.context.list();assert.equal(price.calls[0].p_sort,'price_asc');
});
test('backend selects just one matching female after filters, retains cursor and prior sorts',async()=>{
 const sql=await read('supabase/migrations/20261126120759_discover_pin_first_card_across_pages.sql');
 assert.match(sql,/min\(k.shuffle_key\) filter \(where k.public_gender='female'\)/);
 assert.match(sql,/p_gender is null and p_public_ids is null/);
 assert.match(sql,/o.discover_key > o.cursor_key/);
 assert.match(sql,/split_part\(p_sort, ':', 4\)/);
 assert.match(sql,/p_sort='price_asc'/);
});
