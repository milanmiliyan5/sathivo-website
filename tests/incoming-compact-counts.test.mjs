import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

const types=['sent','received','pending','accepted','completed','cancelled','all'];
const labels=['My Requests','Received','Pending','Accepted','Completed','Cancelled','All'];

test('Requests is a vertically stacked seven-card hub with a same-page Back view',async()=>{
 const html=await read('requests.html');
 assert.match(html,/<h1 class="incoming-compact-title">Requests<\/h1>/);
 assert.doesNotMatch(html,/<section class="page-head">|PRIVATE CONVERSATIONS|Sathivo does not collect payment\. Any cash/);
 assert.match(html,/<nav id="request-menu" class="request-hub"[^>]* hidden>/);
 assert.match(html,/<section id="request-detail" class="request-detail"[^>]* hidden>/);
 assert.match(html,/id="request-back"[^>]*type="button"|id="request-back" class="request-back" type="button"/);
 assert.match(html,/id="requests" class="booking-list"/);
 assert.match(html,/id="empty" class="empty-state" hidden/);
 assert.doesNotMatch(html,/id="request-filters"/);
 const positions=types.map(type=>html.indexOf('data-view="'+type+'"'));
 assert.ok(positions.every(x=>x>=0));
 assert.ok(positions.every((x,i)=>i===0||x>positions[i-1]),'Seven cards must follow the approved order');
 for(let i=0;i<types.length;i++){
  assert.match(html,new RegExp('data-count-for="'+types[i]+'"'));
  assert.ok(html.includes('class="request-hub-name">'+labels[i]+'</span>'));
 }
 assert.match(html,/requests-compact\.css\?v=20261124-heading-left-1/);
 assert.match(html,/requests-page\.js\?v=20261124-vertical-hub-1/);
});
test('My Requests and Received count separate directions; completed is not cancelled',async()=>{
 const js=await read('js/requests-page.js');
 const start=js.indexOf("const cancelledStatuses=new Set(");
 const end=js.indexOf('function receivedCard(r){',start);
 assert.ok(start>=0&&end>start);
 const user={id:'u1'},rows=[
  {id:'s1',customer_id:'u1',companion_id:'u2',status:'pending'},
  {id:'s2',customer_id:'u1',companion_id:'u3',status:'accepted'},
  {id:'s3',customer_id:'u1',companion_id:'u3',status:'completed'},
  {id:'r1',customer_id:'u4',companion_id:'u1',status:'pending'},
  {id:'r2',customer_id:'u5',companion_id:'u1',status:'accepted'},
  {id:'r3',customer_id:'u5',companion_id:'u1',status:'declined'},
  {id:'r4',customer_id:'u4',companion_id:'u1',status:'cancelled'}
 ];
 const nodes=types.map(type=>({dataset:{countFor:type},textContent:''}));
 const ids={'request-view-count':{textContent:''}};
 const document={querySelectorAll:()=>nodes,getElementById:id=>ids[id]};
 const context=vm.createContext({user,rows,view:'sent',document});
 vm.runInContext('const $=id=>document.getElementById(id);'+js.slice(start,end),context);
 const counts=vm.runInContext('requestCounts(rows)',context);
 assert.deepEqual({...counts},{sent:3,received:4,pending:2,accepted:2,completed:1,cancelled:2,all:7});
 vm.runInContext('syncRequestCounts()',context);
 assert.deepEqual(nodes.map(n=>n.textContent),['3','4','2','2','1','2','7']);
 assert.equal(ids['request-view-count'].textContent,'3');
 for(const [type,expected]of [['sent',3],['received',4],['pending',2],['accepted',2],['completed',1],['cancelled',2],['all',7]]){
  context.view=type;
  assert.equal(vm.runInContext('rows.filter(visible).length',context),expected,type);
 }
 context.rows=[{customer_id:'u1',companion_id:'u2',status:'completed'}];
 vm.runInContext('syncRequestCounts()',context);
 assert.equal(nodes.find(n=>n.dataset.countFor==='cancelled').textContent,'0');
 assert.equal(nodes.find(n=>n.dataset.countFor==='completed').textContent,'1');
});
test('Sent and received bookings keep their distinct actions and secured access',async()=>{
 const js=await read('js/requests-page.js');
 assert.match(js,/function receivedCard\(r\)/);
 assert.match(js,/function sentCard\(r\)/);
 assert.match(js,/r\.companion_id===user\.id\?receivedCard\(r\):sentCard\(r\)/);
 assert.match(js,/client\.from\('booking_requests'\)\.select\('\*'\)\.or/);
 assert.match(js,/\.filter\(r=>r\.customer_id===user\.id\|\|r\.companion_id===user\.id\)/);
 for(const action of [
  "update(r.id,'accepted')","update(r.id,'declined')","update(r.id,'completed')",
  "Cancel request","Open chat & photos","cancelBooking(r)","renderBookingProgress(r)",
  "showCompletedBookingRating({client,user,booking:r})","appendRecoveryControls",
  "sendBookingPush","sendBookingEmail","withCurrentBookingNames"
 ])assert.ok(js.includes(action),'Missing action '+action);
 assert.match(js,/function render\(\)\{\s*syncRequestCounts\(\);/);
 assert.match(js,/\[data-view\]/);
 assert.match(js,/\$\('request-back'\)\.addEventListener\('click'/);
 assert.match(js,/client\.channel\('incoming-requests:'/);
 assert.match(js,/if\(requested\?\.status==='accepted'&&requested\.companion_id===user\.id\)/);
});
test('Requests cards have vertical mobile layout, keyboard and safe-area accessibility',async()=>{
 const css=await read('requests-compact.css');
 assert.match(css,/\.request-hub\s*\{[\s\S]*?display:grid;gap:11px/);
 assert.match(css,/\.request-hub-card\s*\{[\s\S]*?width:100%/);
 assert.match(css,/\.request-hub-card:focus-visible/);
 assert.match(css,/\.request-hub-count/);
 assert.match(css,/\.request-back:focus-visible/);
 assert.match(css,/\.incoming-compact-page \[hidden\] \{ display:none!important; \}/);
 assert.match(css,/padding-bottom:calc\(140px \+ env\(safe-area-inset-bottom\)\)/);
 assert.doesNotMatch(css,/grid-template-columns:repeat\(4/);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

test('Requests heading is left aligned above the cards without a decorative box',async()=>{
 const html=await read('requests.html');
 const css=await read('requests-compact.css');
 const title=html.indexOf('<h1 class="incoming-compact-title">Requests</h1>');
 const cards=html.indexOf('id="request-menu"');
 assert.ok(title>=0&&cards>title);
 const style=css.match(/body\.sathivo-2d \.incoming-compact-page \.incoming-compact-title \{([^}]+)\}/);
 assert.ok(style,'Heading rule');
 assert.match(style[1],/text-align:left!important/);
 assert.match(style[1],/padding:0!important/);
 assert.match(style[1],/background:transparent!important/);
 assert.match(style[1],/border:0!important/);
 assert.match(style[1],/box-shadow:none!important/);
});
