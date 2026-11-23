import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('home hero fees remain clear and separate Android release is marked coming soon',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../hero-fee-banner.css',import.meta.url),'utf8');
 const actions=html.indexOf('class="hero-actions"'),banner=html.indexOf('class="hero-fee-banner"'),assurance=html.indexOf('class="hero-assurance"');
 assert.ok(actions>=0&&actions<banner&&banner<assurance);
 assert.match(html,/id="android-coming-soon"/);
 assert.match(html,/Sathivo for Android/);
 assert.match(html,/Not yet available on Google Play/);
 assert.doesNotMatch(html,/href="[^"]*(?:play\\.google\\.com|\\.apk)"/i);
 for(const message of ['Real Connections. Currently Zero Platform Fees.','No subscriptions. No commissions. No hidden platform charges.','Companion service charges are separate.'])assert.ok(html.includes(message));
 assert.ok(html.includes('hero-fee-banner.css?v=20261119-1'));
 assert.ok(css.includes('prefers-reduced-motion'));
});
