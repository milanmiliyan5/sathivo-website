import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {bookingStatusAdvice,adviceForStatus} from '../js/booking-status-help.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('all actual booking statuses provide actionable next steps without claiming payment',()=>{
 assert.deepEqual(Object.keys(bookingStatusAdvice),['pending','accepted','declined','cancelled','completed']);
 for(const [k,text] of Object.entries(bookingStatusAdvice)){assert.ok(text.length>100,k);assert.ok(!/automatically refunded|already paid|guaranteed/i.test(text),k)}
 assert.equal(adviceForStatus('unknown'),bookingStatusAdvice.pending);
});
test('new public booking guide is crawlable, original and linked consistently',async()=>{
 const html=await read('booking-status-help.html');const sitemap=await read('sitemap.xml');
 assert.match(html,/rel="canonical" href="https:\/\/sathivo\.co\/booking-status-help\.html"/);
 assert.match(html,/name="robots" content="index,follow/);
 assert.match(html,/id="booking-stage"/);assert.match(html,/id="booking-stage-answer"/);
 assert.ok((html.match(/<section\b/g)||[]).length>=7);
 assert.ok(html.replace(/<[^>]+>/g,' ').trim().split(/\s+/).length>900);
 assert.doesNotMatch(html,/adsbygoogle|data-ad-slot|pagead2/);
 assert.match(sitemap,/https:\/\/sathivo\.co\/booking-status-help\.html/);
 for(const path of ['index.html','booking-guide.html','companions.html','about.html'])assert.match(await read(path),/href="booking-status-help\.html"/);
});
