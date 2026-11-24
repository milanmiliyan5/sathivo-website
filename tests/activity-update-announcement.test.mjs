import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  ACTIVITY_ANNOUNCEMENT_DELAY_MS,ACTIVITY_ANNOUNCEMENT_TARGET,
  canShowActivityAnnouncement,
} from '../js/activity-update-announcement-policy.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
function mockDoc({hidden=false,hasDialog=false,hasMenu=false,authPending=false,editing=false}={}){
 return {
  hidden,visibilityState:hidden?'hidden':'visible',
  querySelector(selector){
   if(hasDialog&&selector.includes('dialog[open]'))return {};
   if(hasMenu&&selector.includes('.mobile-header-menu[open]'))return {};
   return null;
  },
  body:{classList:{contains(name){return authPending&&name==='auth-pending'}}},
  activeElement:{matches:()=>editing},
 };
}

test('announcement starts at 5s, respects editing, dialogs, hidden tabs and auth routes',()=>{
 assert.equal(ACTIVITY_ANNOUNCEMENT_DELAY_MS,5000);
 assert.equal(ACTIVITY_ANNOUNCEMENT_TARGET,'profile.html#your-kind-of-company');
 const loc={pathname:'/',hash:''};
 assert.equal(canShowActivityAnnouncement(mockDoc(),loc),true);
 assert.equal(canShowActivityAnnouncement(mockDoc({hidden:true}),loc),false);
 assert.equal(canShowActivityAnnouncement(mockDoc({hasDialog:true}),loc),false);
 assert.equal(canShowActivityAnnouncement(mockDoc({hasMenu:true}),loc),false);
 assert.equal(canShowActivityAnnouncement(mockDoc({authPending:true}),loc),false);
 assert.equal(canShowActivityAnnouncement(mockDoc({editing:true}),loc),false);
 assert.equal(canShowActivityAnnouncement(mockDoc(),{pathname:'/account.html',hash:'#login'}),false);
 assert.equal(canShowActivityAnnouncement(mockDoc(),{pathname:'/account.html',hash:'#account'}),true);
 assert.equal(canShowActivityAnnouncement(mockDoc(),{pathname:'/',hash:'#experiences'}),false);
});

test('notice runs on Home, Explore, Account, and never while editing My Profile',async()=>{
 for(const path of ['index.html','companions.html','account.html']){
  const html=await read(path);
  assert.match(html,/activity-update-announcement\.css\?v=20261122-1/);
  assert.match(html,/js\/activity-update-announcement\.js\?v=20261122-1/);
 }
 const profile=await read('profile.html');
 assert.doesNotMatch(profile,/activity-update-announcement\.js/);
 assert.match(profile,/id="your-kind-of-company" tabindex="-1"/);
 const profileScript=await read('js/profile-page.js');
 assert.match(profileScript,/location\.hash==='#your-kind-of-company'/);
 assert.match(profileScript,/scrollIntoView/);
 assert.match(profileScript,/focus\(\{preventScroll:true\}\)/);
});

test('popup uses auth-confirmed, per-account one-time DB claim, with friendly actions',async()=>{
 const src=await read('js/activity-update-announcement.js');
 assert.match(src,/client\.auth\.getSession\(\)/);
 assert.match(src,/client\.auth\.getUser\(\)/);
 assert.match(src,/\.from\(TABLE\)/);
 assert.match(src,/\.update\(\{shown_at:new Date\(\)\.toISOString\(\)\}\)/);
 assert.match(src,/\.eq\('user_id',user\.id\)/);
 assert.match(src,/\.is\('shown_at',null\)/);
 assert.match(src,/\.select\('user_id'\)/);
 assert.match(src,/if\(!claimed\?\.length\)return/);
 assert.match(src,/Explore New Activities/);
 assert.match(src,/Maybe Later/);
 assert.match(src,/13 new activities/);
 assert.match(src,/non-medical social company/);
 assert.match(src,/canShowActivityAnnouncement\(document,window\.location\)/);
});
test('eligibility is pre-seeded and only the owner may atomically claim a notice once',async()=>{
 const sql=await read('supabase/migrations/20261122181903_companion_21_activity_one_time_announcement.sql');
 assert.match(sql,/primary key references auth\.users\(id\) on delete cascade/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.companion_activity_update_prompts from public, anon, authenticated/);
 assert.match(sql,/grant select\(user_id,shown_at\), update\(shown_at\)/);
 assert.match(sql,/using \(\(select auth\.uid\(\)\)=user_id and shown_at is null\)/);
 assert.match(sql,/with check \(\(select auth\.uid\(\)\)=user_id and shown_at is not null\)/);
 assert.match(sql,/p\.profile_kind in \('companion','both'\)/);
 assert.match(sql,/p\.joined_at < timestamptz '2026-11-22 17:56:01\+00'/);
 assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:public\.)?(?:member_profiles|booking_requests|booking_messages|companion_listings)\b/i);
});

test('Profile tabs keep one form and preserve validation, publish and browser history',async()=>{
 const html=await read('profile.html'),js=await read('js/profile-page.js'),css=await read('profile.css');
 assert.equal((html.match(/role="tab" id="profile-tab-/g)||[]).length,3);
 assert.equal((html.match(/id="profile-form"/g)||[]).length,1);
 for(const section of ['personal','companion','privacy'])assert.ok(html.includes('data-profile-panel="'+section+'"'));
 assert.match(html,/data-profile-extra="privacy"/);
 assert.match(html,/id="profile-form" novalidate/);
 assert.match(js,/revealProfileControl\(invalid\);invalid\.reportValidity\(\)/);
 assert.match(js,/history\.pushState/);
 assert.match(js,/window\.addEventListener\('popstate'/);
 assert.match(js,/beforeunload/);
 assert.match(js,/from\('member_profiles'\)\.upsert\(row/);
 assert.match(js,/publishing\.publishSavedProfile/);
 assert.doesNotMatch(html,/nearby_email_opt_in/);
 assert.doesNotMatch(js,/nearby_alert_preferences/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
