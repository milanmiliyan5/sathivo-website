import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('homepage has one easily reversible fee-free growth banner below hero',async()=>{
 const html=await read('index.html');
 const css=await read('home-free-join.css');
 assert.equal((html.match(/id="free-join-promo"/g)||[]).length,1);
 assert.ok(html.indexOf('id="free-join-promo"')>html.indexOf('class="hero container"'));
 assert.ok(html.indexOf('id="free-join-promo"')<html.indexOf('id="how-it-works"'));
 assert.match(html,/home-free-join\.css\?v=20261124-1/);
 assert.match(html,/class="free-join-promo-cta" href="profile.html"/);
 assert.match(html,/Companions set their own rates/);
 assert.match(html,/any payment is agreed directly between users/);
 assert.match(css,/:has\(#free-join-promo\) \.hero-fee-banner\{display:none\}/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/:focus-visible/);
});
