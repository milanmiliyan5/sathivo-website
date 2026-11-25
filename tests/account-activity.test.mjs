import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('account hub retains SVG actions and navigation badges after compact redesign',async()=>{
 const html=await read('account.html');
 const home=html.split('data-account-screen="home"')[1].split('data-account-screen="public-preview"')[0];
 const rows=[...home.matchAll(/<(a|button) class="account-hub-row"[^>]*>[\s\S]*?<\/\1>/g)].map(m=>m[0]);
 assert.equal(rows.length,9);
 for(const row of rows){
  assert.match(row,/class="account-hub-icon[^"]*"[\s\S]*?<svg/);
  assert.match(row,/<span class="account-hub-copy"><strong>[^<]+<\/strong><\/span>/);
  assert.doesNotMatch(row,/<small>/);
  assert.match(row,/href="[^"]+"|data-account-open="[^"]+"/);
 }
 for(const label of ['My Profile','Saved Companions','Settings','Notifications','Nearby Discovery','Help &amp; Support','Feedback','Support Sathivo','Privacy &amp; Safety'])assert.ok(home.includes('<strong>'+label+'</strong>'),label);
 const css=await read('account.css');
 assert.match(css,/\.account-hub-list\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.account-hub-row\{[^}]*display:flex;align-items:center/);
 assert.match(css,/\.account-hub-row:focus-visible/);
 const nav=await read('js/mobile-nav.js');
 assert.match(nav,/refs\.Requests\.hidden=rn===0/);
 assert.match(nav,/refs\.Chats\.hidden=cn===0/);
 assert.match(await read('js/header-requests.js'),/indicators\.forEach/);
});
test('Account has one profile menu and leaves Companion settings inside My Profile',async()=>{
 const html=await read('account.html'),js=await read('js/account-page.js'),profile=await read('profile.html');
 const home=html.split('data-account-screen="home"')[1].split('data-account-screen="public-preview"')[0];
 assert.equal((home.match(/<strong>My Profile<\/strong>/g)||[]).length,1);
 assert.doesNotMatch(home,/account-companion-link|<strong>Companion Profile<\/strong>|<strong>Become a Companion<\/strong>/);
 assert.doesNotMatch(js,/account-companion-link/);
 assert.match(profile,/id="profile-tab-companion"/);
});
