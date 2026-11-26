import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {seriesWindow,donutParts} from '../js/admin-visuals.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('daily chart range preserves actual counts and handles zeros',()=>{
 const rows=Array.from({length:30},(_,i)=>({day:'day'+i,visitors:i,signups:0}));
 assert.deepEqual(seriesWindow(rows,7,'visitors').values,[23,24,25,26,27,28,29]);assert.equal(seriesWindow(rows,1,'visitors').total,29);assert.equal(seriesWindow(rows,30,'signups').max,4);assert.equal(seriesWindow(rows,30,'signups').total,0);
});
test('donut parts add to correct totals and have valid empty state',()=>{
 const r=donutParts([['a',2,'red'],['b',3,'blue'],['c',0,'gray']]);assert.equal(r.total,5);assert.equal(r.parts[0].end,40);assert.equal(r.parts[1].end,100);assert.equal(donutParts([['a',0,'red']]).parts[0].end,0);
});
test('visuals use one manually refreshed authenticated aggregate and preserve admin navigation',async()=>{
 const [html,js,mod,sql]=await Promise.all([read('admin.html'),read('js/admin-page.js'),read('js/admin-visuals.js'),read('supabase/migrations/20261126070242_admin_visual_summary.sql')]);
 assert.equal((js.match(/rpc\('admin_visual_summary'\)/g)||[]).length,1);assert.doesNotMatch(mod,/setInterval|setTimeout|\.rpc\(|fetch\(/);
 for(const id of ['visual-growth-plot','visual-donut','visual-cities','visual-gender','visual-top-companions','recent-activity','founder-section','maintenance-section','refresh-dashboard'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.match(sql,/auth.uid\(\) is null/);assert.match(sql,/platform_admins/);assert.match(sql,/security invoker/);assert.match(sql,/revoke all/);assert.match(sql,/generate_series\(0,29\)/);
});
