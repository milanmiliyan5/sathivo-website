import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pageWindow,ADMIN_PAGE_SIZE} from '../js/admin-table-pages.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('admin pagination preserves all records, clamps page after filters and bounds DOM work',()=>{
 const records=Array.from({length:231},(_,i)=>i);
 assert.equal(ADMIN_PAGE_SIZE,50);
 assert.deepEqual(pageWindow(records,0).rows,records.slice(0,50));
 assert.deepEqual(pageWindow(records,4).rows,records.slice(200));
 assert.equal(pageWindow(records,999).page,4);
 assert.equal(pageWindow([],4).start,0);
 assert.equal(pageWindow([1],4).page,0);
 const collected=Array.from({length:pageWindow(records).pages},(_,i)=>pageWindow(records,i).rows).flat();
 assert.deepEqual(collected,records);
});
test('admin tables share pager, keep full snapshot search, and do not fetch when paging',async()=>{
 const [html,js]=await Promise.all([read('admin.html'),read('js/admin-page.js')]);
 for(const id of ['users','bookings','support-requests','feedback-requests','reports','listings']){
  assert.ok(html.includes('id="'+id+'-pager"'));
  assert.ok(js.includes("renderTablePage('"+id+"',rows"));
 }
 const render=js.split('function renderTablePage(')[1].split('function resetTablePage')[0];
 assert.doesNotMatch(render,/client\.|fetch\(|rpc\(/);
 assert.match(js,/snapshotReady=false/);assert.match(js,/Promise\.allSettled/);
 assert.match(js,/requestAnimationFrame/);
 assert.match(js,/account_policy_warnings/);
});
