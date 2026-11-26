import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {chartWindow,hourLabel} from '../js/admin-visuals.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Today uses real elapsed hourly rows, not daily singleton or future hours',()=>{
 const data={days:Array.from({length:30},(_,i)=>({visitors:i})),hours:[{hour:0,visitors:2},{hour:1,visitors:0},{hour:2,visitors:7}]};
 assert.deepEqual(chartWindow(data,1,'visitors').values,[2,0,7]);assert.equal(chartWindow(data,1,'visitors').total,9);
 assert.deepEqual(chartWindow({days:data.days},1,'visitors').rows,[]);
 assert.equal(chartWindow(data,7,'visitors').rows.length,7);assert.equal(chartWindow(data,30,'visitors').rows.length,30);
 assert.equal(hourLabel(0),'12 AM');assert.equal(hourLabel(12),'12 PM');assert.equal(hourLabel(23),'11 PM');
});
test('hourly data remains admin-only with one existing manual RPC and measured sticky header offset',async()=>{
 const [sql,js,css]=await Promise.all([read('supabase/migrations/20261126071032_admin_visual_hourly_summary.sql'),read('js/admin-visuals.js'),read('admin-dashboard.css')]);
 assert.match(sql,/auth.uid\(\) is null/);assert.match(sql,/first_seen at time zone 'Asia\/Kolkata'/);assert.match(sql,/generate_series\(0,extract\(hour/);
 assert.match(js,/ResizeObserver/);assert.match(js,/partial hour/);assert.match(css,/scroll-padding-top:calc\(var\(--admin-sticky-offset/);
 assert.doesNotMatch(js,/setInterval|setTimeout|\.rpc\(/);
});
