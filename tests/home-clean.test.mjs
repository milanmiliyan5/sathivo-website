import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {experienceCategories} from '../js/experience-categories.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('clean homepage preserves all 21 activity deep links and entry / trust content',async()=>{
 const html=await read('index.html'),css=await read('home-clean.css'),directory=await read('js/companions-page.js');
 const values=[...html.matchAll(/href="companions\.html\?category=([^"]+)"/g)].map(m=>decodeURIComponent(m[1]));
 assert.deepEqual(values,experienceCategories);
 for(const id of ['free-join-promo','how-it-works','guides','safety','faq','android-coming-soon','sathivo-entry-preflight','info-dialog'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/home-entry\.js/);assert.match(html,/launch-splash\.js/);assert.match(html,/policy-warning-gate\.js/);
 assert.match(directory,/requestedCategory&&experienceCategoryGroups\.some/);
 assert.match(css,/@media\(max-width:640px\)/);assert.match(css,/prefers-reduced-motion/);
});