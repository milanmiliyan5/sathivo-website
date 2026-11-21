import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicDirectoryPreview,addPreviewToDirectory} from '../functions/companions.html.js';
test('initial HTML has server-readable published profile cards without extra data',()=>{
 const rows=[{public_id:'23456789-abcd-4abc-8def-123456789012',display_name:'Riya <script>alert(1)</script>',bio:'Coffee <& discussion',city_name:'Bhubaneswar',hourly_rate:300,categories:['Coffee','Movies'],meeting_mode:'both'}];
 const html=publicDirectoryPreview(rows);
 assert.match(html,/View published profile/);
 assert.match(html,/Bhubaneswar/);
 assert.match(html,/₹300 \/ hour/);
 assert.ok(html.includes('Riya &lt;script&gt;'));
 assert.ok(!html.includes('<script>alert'));
 assert.ok(!html.includes('mailto:'));
 assert.ok(!html.includes('photo_path'));
 assert.ok(!html.includes('private'));
 const page=addPreviewToDirectory('<section id="results" tabindex="-1" class="companion-grid" aria-label="Companions"></section>',rows);
 assert.match(page,/companion.html\?id=/);
});
test('unknown or unsafe ids are excluded and empty data remains unchanged',()=>{
 assert.equal(publicDirectoryPreview([{public_id:'bad',display_name:'Name'}]),'');
 const before='<section id="results" tabindex="-1" class="companion-grid" aria-label="Companions"></section>';
 assert.equal(addPreviewToDirectory(before,[]),before);
 assert.equal(publicDirectoryPreview(null),'');
});
test('server preview uses the same public-only browsing RPC and preserves static fallback',async()=>{
 const src=await readFile(new URL('../functions/companions.html.js',import.meta.url),'utf8');
 assert.match(src,/browse_public_companions_v3/);
 assert.match(src,/authConfig.publishableKey/);
 assert.match(src,/env.ASSETS.fetch\(request\)/);
 assert.doesNotMatch(src,/service_role|secret_key|SUPABASE_SECRET|admin_users/i);
 assert.match(src,/catch\{return asset\}/);
 const source=await readFile(new URL('../companions.html',import.meta.url),'utf8');
 assert.match(source,/id="results" tabindex="-1" class="companion-grid" aria-label="Companions"><\/section>/);
 assert.match(source,/js\/companions-page\.js/);
});
