import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('account activity cards have consistent SVG icons, actions and badge placeholders',async()=>{
 const html=await read('account.html');
 const grid=html.match(/<div class="account-activity-grid">[\s\S]*?<\/div>/)[0];
 const cards=[...grid.matchAll(/<a\b[\s\S]*?<\/a>/g)].map(m=>m[0]);
 assert.equal(cards.length,4);
 for(const [i,href] of ['bookings','requests','chats','notifications'].entries()){
  assert.match(cards[i],new RegExp('href="'+href+'\\.html"'));
  assert.match(cards[i],/class="activity-icon"[\s\S]*?<svg/);
  assert.match(cards[i],/<strong>[^<]+<\/strong><small>[^<]+<\/small>/);
 }
 assert.match(cards[1],/id="account-incoming-requests" hidden/);
 for(const [i,cls] of ['request-badge','chat-header-badge','notification-badge'].entries())assert.match(cards[i+1],new RegExp('activity-count '+cls+'" hidden'));
 const css=await read('account.css');
 assert.match(css,/\.account-activity-grid > a\.activity-card\s*\{[^}]*display:flex!important;flex-direction:column/);
 assert.match(css,/\.activity-card\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.activity-count \{[^}]*position:absolute/);
 assert.match(await read('js/header-requests.js'),/indicators\.forEach/);
});
