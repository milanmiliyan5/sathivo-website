import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canClean,checklist} from '../js/admin-maintenance.js';
test('cleanup eligibility requires real positive scan count',()=>{
 assert.equal(canClean(null),false);assert.equal(canClean({rate_limit_expired:0}),false);assert.equal(canClean({rate_limit_expired:'5'}),false);assert.equal(canClean({rate_limit_expired:5}),true);assert.equal(checklist.length,10);
});
test('maintenance is manual and runs only after admin authorization',async()=>{
 const page=await readFile(new URL('../js/admin-page.js',import.meta.url),'utf8');
 const ui=await readFile(new URL('../js/admin-maintenance.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../admin.html',import.meta.url),'utf8');
 const edge=await readFile(new URL('../supabase/functions/admin-maintenance/index.ts',import.meta.url),'utf8');
 const sql=await readFile(new URL('../backend/admin-maintenance.sql',import.meta.url),'utf8');
 assert.ok(page.indexOf('if(!a.data)throw')<page.indexOf('initMaintenance(client,user.id)'));
 assert.match(html,/id="maintenance-clean"[^>]*disabled/);
 assert.doesNotMatch(ui,/setInterval|setTimeout|localStorage\.clear/);
 assert.match(ui,/window\.confirm/);
 assert.match(edge,/if \(adminError \|\| !adminRow\)/);
 assert.match(edge,/body\.confirmed!==true/);
 assert.match(sql,/revoke all on function public\.admin_maintenance_server_v1\(boolean\) from public,anon,authenticated/);
 assert.deepEqual([...sql.matchAll(/delete from ([\w.]+)/gi)].map(m=>m[1]),['public.edge_rate_limits']);
 assert.match(sql,/window_start < cutoff and updated_at < cutoff/);
 assert.match(sql,/interval '30 days'/);
});
