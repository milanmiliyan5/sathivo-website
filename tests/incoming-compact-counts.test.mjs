import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Requests opens directly at compact heading and four counted filters',async()=>{
 const html=await read('requests.html');
 assert.match(html,/class="container marketplace-shell incoming-compact-page"/);
 assert.match(html,/<h1 class="incoming-compact-title">Requests<\/h1>/);
 assert.doesNotMatch(html,/<section class="page-head">/);
 assert.doesNotMatch(html,/Sathivo does not collect payment\. Any cash or UPI payment/);
 assert.doesNotMatch(html,/As a companion, review requests customers have sent you/);
 for(const name of ['pending','accepted','closed','all']){
  assert.match(html,new RegExp('data-filter="'+name+'"'));
  assert.match(html,new RegExp('data-count-for="'+name+'"'));
 }
 assert.match(html,/aria-controls="requests"/);
 assert.match(html,/id="requests" class="booking-list"/);
 assert.match(html,/requests-compact\.css\?v=20261123-count-first-inline-1/);
 assert.match(html,/js\/requests-page\.js\?v=20261123-incoming-counts-1/);
});
test('Counts follow the existing pending, accepted and closed status definitions',async()=>{
 const js=await read('js/requests-page.js');
 const start=js.indexOf('const closedStatuses=new Set(');
 const end=js.indexOf('function card(r){',start);
 assert.ok(start>0&&end>start,'Pure count and filter functions are present');
 const nodes=['pending','accepted','closed','all'].map(name=>({
  dataset:{countFor:name},textContent:''
 }));
 const context=vm.createContext({
  rows:[],filter:'pending',document:{querySelectorAll:()=>nodes}
 });
 vm.runInContext(js.slice(start,end),context);
 const entries=[
  {status:'pending'},{status:'pending'},{status:'accepted'},
  {status:'declined'},{status:'cancelled'},{status:'completed'}
 ];
 context.rows=entries;
 const count=vm.runInContext('requestCounts(rows)',context);
 assert.deepEqual({...count},{pending:2,accepted:1,closed:3,all:6});
 vm.runInContext('syncRequestCounts()',context);
 assert.deepEqual(nodes.map(n=>n.textContent),['2','1','3','6']);
 const first=vm.runInContext('visible(rows[0])',context);
 assert.equal(first,true);
 context.filter='closed';
 assert.equal(vm.runInContext('rows.filter(visible).length',context),3);
 context.filter='all';
 assert.equal(vm.runInContext('rows.filter(visible).length',context),6);
 context.rows=[{status:'accepted'}];
 vm.runInContext('syncRequestCounts()',context);
 assert.deepEqual(nodes.map(n=>n.textContent),['0','1','0','1']);
});
test('Request count update is driven by render/realtime and booking actions are preserved',async()=>{
 const js=await read('js/requests-page.js');
 assert.match(js,/function render\(\)\{\s*syncRequestCounts\(\);/);
 assert.doesNotMatch(js,/String\(list\.length\)\+' request'/);
 assert.match(js,/\.on\('postgres_changes'/);
 assert.match(js,/await load\(\)/);
 for(const token of ['async function update(','async function cancelBooking(','async function recoverBooking(','sendBookingPush','sendBookingEmail','confirmCompletion','runRecovery','withCurrentBookingNames'])assert.ok(js.includes(token),token);
 assert.match(js,/aria-pressed/);
});
test('Scoped styles keep tabs above requests, accessible and responsive',async()=>{
 const css=await read('requests-compact.css');
 assert.match(css,/#request-filters\[hidden\]\{display:none!important\}/);
 assert.match(css,/#request-filters \.request-tab-count/);
 assert.match(css,/#request-filters button\.active/);
 assert.match(css,/#request-filters button:focus-visible/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/padding-bottom:calc\(137px \+ env\(safe-area-inset-bottom\)\)/);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

test('Status count appears before label and four pills stay on one row',async()=>{
 const html=await read('requests.html');
 const css=await read('requests-compact.css');
 for(const [key,label] of [['pending','Pending'],['accepted','Accepted'],['closed','Closed'],['all','All']]){
  const badge=html.indexOf('data-count-for="'+key+'"');
  const name=html.indexOf('class="request-tab-label">'+label+'</span>');
  assert.ok(badge>=0&&name>badge,key+' number must precede its label');
 }
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/flex-direction:row;flex-wrap:nowrap/);
 assert.match(css,/white-space:nowrap;min-width:0/);
 assert.doesNotMatch(css,/flex-direction:column;gap:4px;min-width:0;width:100%/);
});
