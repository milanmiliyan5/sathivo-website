import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('admin companion listings use the original search, status and moderation UI',async()=>{
 const html=await read('admin.html'),script=await read('js/admin-page.js'),css=await read('admin-dashboard.css');
 assert.match(html,/id="listing-search"/);
 assert.match(html,/id="listing-status-filter"/);
 assert.match(html,/<th>Companion<\/th><th>Bio<\/th><th>Published<\/th><th>Status<\/th><th>Action<\/th>/);
 for(const needle of ['listing-quality-filter','listing-quality-summary','listing-quality-panel','Quality review','flagged for human review','policy/contact review','AdSense approval is not guaranteed']){
  assert.equal(html.includes(needle),false,needle);
 }
 assert.doesNotMatch(css,/listing-quality/);
 assert.doesNotMatch(script,/assessListingQuality|summarizeListingQuality|qualityDuplicates|listing-quality-filter|listing-quality-summary|companion-quality\.js/);
 assert.match(script,/const q=\$\('listing-search'\)\.value\.trim\(\)\.toLowerCase\(\),status=value\('listing-status-filter'\)/);
 assert.match(script,/renderTablePage\('listings',rows,listingRow,5,'No matching companion listings\.'\)/);
 assert.match(script,/emptyRow\(columns,emptyMessage\)/);
 assert.match(script,/b\.onclick=\(\)=>void setListing\(r\.user_id,next\)/);
});
test('profile publishing and public explore no longer show optional bio quality prompts',async()=>{
 const profile=await read('profile.html'),explore=await read('companions.html');
 assert.doesNotMatch(profile,/Quality checklist before publishing|Do not include phone numbers, email addresses, WhatsApp/);
 assert.match(profile,/id="publish-listing"/);
 assert.match(profile,/id="publish-consent"/);
 assert.doesNotMatch(explore,/What a useful public profile should tell you|A helpful listing explains the activities/);
 assert.match(explore,/Compare the actual activity, not just the picture/);
 assert.match(explore,/Understand the price before you request/);
});
test('manual global Refresh All and safety/report moderation remain unchanged',async()=>{
 const html=await read('admin.html'),page=await read('js/admin-page.js');
 assert.match(html,/id="refresh-dashboard"[^>]*>↻ Refresh All/);
 const refresh = page.slice(page.indexOf('async function refreshAll()'),page.indexOf('await refreshAll();startPresence()'));
 const batch = refresh.match(/await Promise\.allSettled\(\[([^\]]+)\]\)/);
 assert.ok(batch,'Refresh waits for every section');
 for(const call of ['load()', 'loadStats()', 'refreshContributions(client)', 'refreshSidebarBadges()', 'founder?.refresh()', 'refreshDeletions(client)', 'refreshOfficialInbox(client)'])assert.ok(batch[1].split(',').map(s=>s.trim()).includes(call),call);
 assert.match(page,/await refreshAll\(\);startPresence\(\)/);
 assert.match(html,/id="support-section"/);
 assert.match(html,/id="reports-section"/);
 assert.match(page,/async function setSupport\(/);
 assert.match(page,/async function setReport\(/);
});
