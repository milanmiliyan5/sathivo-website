import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Personal cleanup preserves all form controls, safety guidance and native photo upload',async()=>{
 const html=await read('profile.html'),css=await read('profile.css'),js=await read('js/profile-page.js');
 const personal=html.split('id="profile-panel-personal"')[1].split('id="profile-panel-companion"')[0];
 for(const id of ['profile_kind','avatar','photo','avatar-choices','clear-avatar','display_name','gender','bio','state','district','city_name','location_id','languages','interests'])assert.ok(personal.includes('id="'+id+'"'),id);
 assert.match(personal,/<label class="personal-photo-action" for="photo">[\s\S]*?Change photo[\s\S]*?<input id="photo" type="file" accept="image\/jpeg,image\/png,image\/webp"/);
 assert.match(personal,/Photo or avatar required to publish/);
 assert.match(personal,/20\+ characters to publish\. No phone numbers, email or exact addresses/);
 assert.match(css,/\.personal-photo-action:focus-within/);
 assert.match(css,/#profile-panel-personal #photo\{position:absolute;inset:0;opacity:0/);
 assert.match(js,/\$\('photo'\)\.addEventListener\('change'/);
 assert.match(js,/profileSectionCompletion/);
 assert.match(js,/from\('member_profiles'\)\.upsert/);
 assert.equal((html.match(/class="profile-section-tick"/g)||[]).length,3);
});