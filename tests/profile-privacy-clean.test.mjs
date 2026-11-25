import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Privacy cleanup preserves consent, visibility switches and saved declarations',async()=>{
 const html=await read('profile.html'),css=await read('profile.css'),js=await read('js/profile-page.js'),publish=await read('js/listing-publish.js');
 for(const id of ['publish-listing','public-gender-consent','view-listing','adult-confirmed-status','boundaries-confirmed-status','adult-confirmation-control','boundaries-confirmation-control','profile-nearby-alerts','publish-consent'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.equal((html.match(/role="switch"/g)||[]).length,2);
 assert.match(html,/name="adult_confirmed" type="checkbox" required/);
 assert.match(html,/name="boundaries_accepted" type="checkbox" required/);
 assert.match(html,/class="privacy-info"[\s\S]*?Privacy Information[\s\S]*?What becomes public\?/);
 assert.match(html,/Sexual services, sexual offers and escort services are prohibited/);
 assert.match(html,/id="profile-nearby-alerts" href="account.html#account"/);
 assert.match(css,/\.visibility-actions \[hidden\]\{display:none!important\}/);
 assert.match(js,/function markSafetySaved/);
 assert.match(publish,/view\.hidden=!\(known&&listing\?\.published&&draft\.published\)/);
});