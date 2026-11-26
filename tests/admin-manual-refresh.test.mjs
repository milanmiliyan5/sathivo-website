import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Admin has one global manual data refresh button covering every section',async()=>{
 const html=await read('admin.html');
 const page=await read('js/admin-page.js');
 assert.match(html,/id="refresh-dashboard"[^>]*>↻ Refresh All/);
 assert.equal((html.match(/id="refresh-dashboard"/g)||[]).length,1);
 assert.doesNotMatch(html,/id="contribution-admin-refresh"/);
 assert.match(html,/Updated with the top Refresh All button/);
 for(const section of ['overview','users-section','bookings-section','support-section','feedback-section','contributions-section','reports-section','listings-section']){
   assert.match(html,new RegExp('id="'+section+'"'));
 }
 assert.match(page,/\$\('refresh-dashboard'\)\.addEventListener\('click',\(\)=>void refreshAll\(\)\)/);
 assert.match(page,/Promise\.allSettled\(\[load\(\),loadStats\(\),refreshContributions\(client\),refreshSidebarBadges\(\),founder\?\.refresh\(\)\]\)/);
 assert.match(page,/await refreshAll\(\);startPresence\(\)/);
});
test('Admin does not automatically fetch all records every few seconds or on section navigation',async()=>{
 const page=await read('js/admin-page.js');
 const badges=await read('js/admin-sidebar-badges.js');
 const contributions=await read('js/admin-contributions.js');
 assert.doesNotMatch(page,/startBadgeUpdates|startSidebarBadgePolling|setInterval\s*\(|setTimeout\s*\(/);
 assert.doesNotMatch(badges,/setInterval\s*\(|setTimeout\s*\(|visibilitychange|addEventListener\('focus'/);
 assert.doesNotMatch(page,/refreshAll\(false\)/);
 assert.match(page,/async function onSidebarSectionSelected\(section\)/);
 const route=page.split('async function onSidebarSectionSelected(section)')[1].split('let statsRequest=null')[0];
 assert.doesNotMatch(route,/refreshAll\s*\(|fetchStats\s*\(|\bload\s*\(|refreshSidebarBadges\s*\(/);
 assert.doesNotMatch(contributions,/contribution-admin-refresh/);
});
test('User action updates its row locally; no full data fetch until owner clicks Refresh',async()=>{
 const page=await read('js/admin-page.js');
 for(const method of ['setSupport','setReport','setListing']){
   const block=page.split('async function '+method+'(')[1].split('\n}')[0];
   assert.doesNotMatch(block,/refreshAll/);
 }
 const reopen=page.split('async function adminReopen(')[1].split('\n}')[0];
 assert.doesNotMatch(reopen,/refreshAll/);
 assert.match(page,/badgeCounts=\{\.\.\.badgeCounts,\[key\]:0\}/);
 assert.match(page,/p_seen_through:badgeSnapshot/);
});
test('Online presence remains subscribed but only updates displayed snapshot on initial sync and manual refresh',async()=>{
 const html=await read('admin.html'),page=await read('js/admin-page.js');
 assert.match(html,/Online snapshot/);
 assert.match(html,/Manual updates/);
 assert.match(page,/if\(!initialSnapshotShown\)\{initialSnapshotShown=true;updateOnline\(\);\}/);
 assert.doesNotMatch(page,/event:'join'/);
 assert.doesNotMatch(page,/event:'leave'/);
});
