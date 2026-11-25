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
test('homepage offers headline loops seamlessly and supports pausing',async()=>{
 const html=await read('index.html'),css=await read('home-clean.css');
 const sets=[...html.matchAll(/<div class="home-ticker-set">([\s\S]*?)<\/div>/g)].map(m=>m[1]);
 assert.equal(sets.length,2);assert.equal(sets[0],sets[1]);
 for(const label of ['FREE TO JOIN','FREE PROFILE CREATION','NO PLATFORM FEES CURRENTLY','FREE BOOKING REQUESTS','COMPANION RATES MAY APPLY','18+ · STRICTLY PLATONIC'])assert.ok(sets[0].includes(label));
 assert.match(css,/animation:home-headline-scroll 32s linear infinite/);
 assert.match(css,/translateX\(-50%\)/);
 assert.match(css,/animation-play-state:paused/);
 assert.match(css,/prefers-reduced-motion:reduce[^\n]*home-ticker-track\{animation:none/);
 assert.match(html,/aria-label="Pause headline"/);
 assert.ok(html.indexOf('home-moving-announcement')<html.indexOf('<header class="site-header">'));
});
