import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {safeBadgeCount,badgeLabel,sidebarBadgeSections,sidebarReadAcknowledgements,updateSidebarBadges} from '../js/admin-sidebar-badges.js';

test('badges are only shown for six requested admin sections',async()=>{
 assert.deepEqual(Object.keys(sidebarBadgeSections),['users-section','bookings-section','support-section','feedback-section','contributions-section','reports-section']);
 const html=await readFile(new URL('../admin.html',import.meta.url),'utf8');
 for(const section of Object.keys(sidebarBadgeSections)){
   assert.match(html,new RegExp('data-section="'+section+'"[^>]*>[^\\n]*class="sidebar-count" hidden'));
 }
 assert.ok(!html.includes('data-section="listings-section"><span class="sidebar-count"'));
 assert.deepEqual(sidebarReadAcknowledgements,['users','bookings','contributions']);
});
test('new-count formatting is compact and rejects invalid data',()=>{
 for(const n of [undefined,null,-1,NaN,Infinity,0,'invalid'])assert.equal(safeBadgeCount(n),0);
 assert.equal(badgeLabel(1),'1');assert.equal(badgeLabel(99),'99');assert.equal(badgeLabel(100),'99+');
});
test('badge count toggles accessibility label and hidden state',()=>{
 const attributes=new Map();
 const badge={hidden:true,textContent:''};
 const link={dataset:{},querySelector(selector){
   if(selector==='.sidebar-count')return badge;
   if(selector==='.sidebar-text')return {textContent:'Users'};
   return null;
 },setAttribute(k,v){attributes.set(k,v)},removeAttribute(k){attributes.delete(k)}};
 const root={querySelector(selector){return selector.includes('users-section')?link:null}};
 updateSidebarBadges(root,{users:3});
 assert.equal(badge.hidden,false);assert.equal(badge.textContent,'3');
 assert.equal(attributes.get('aria-label'),'Users, 3 new');
 updateSidebarBadges(root,{users:0});
 assert.equal(badge.hidden,true);assert.equal(badge.textContent,'');
 assert.equal(attributes.has('aria-label'),false);
});
test('badge API is admin-only and supports persistent view markers',async()=>{
 const migration=await readFile(new URL('../supabase/migrations/20261121082300_secure_admin_sidebar_new_activity_badges.sql',import.meta.url),'utf8');
 assert.match(migration,/enable row level security/);
 assert.match(migration,/from public,anon,authenticated/);
 assert.match(migration,/grant execute on function public\.sathivo_admin_sidebar_badges\(\) to authenticated/);
 assert.match(migration,/not exists \(\s*select 1 from public\.platform_admins/);
 assert.match(migration,/verified_payment_id is not null/);
});
