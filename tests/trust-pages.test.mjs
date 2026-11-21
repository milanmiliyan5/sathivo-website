import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const newPages=['guides.html','contact.html','disclaimer.html','editorial-policy.html'];
test('trust and guide-hub pages have complete crawlable HTML and internal navigation',async()=>{
 const sitemap=await read('sitemap.xml');
 for(const file of newPages){
  const html=await read(file);
  assert.match(html,/<html lang="en">/,file);
  assert.match(html,/name="viewport"/,file);
  assert.match(html,/name="robots" content="index,follow/,file);
  assert.match(html,new RegExp('rel="canonical" href="https://sathivo\\.co/'+file.replaceAll('.','\\.')+'"'),file);
  assert.match(html,/<meta name="description" content=".{25,}"/,file);
  assert.match(html,/<main id="main"/,file);
  assert.match(html,/<h1[ >]/,file);
  assert.match(html,/href="contact\.html"/,file);
  assert.match(html,/href="disclaimer\.html"/,file);
  assert.match(html,/href="privacy\.html"/,file);
  assert.match(html,/href="terms\.html"/,file);
  assert.match(html,/href="editorial-policy\.html"/,file);
  assert.match(html,/js\/site-presence\.js/,file);
  assert.doesNotMatch(html,/adsbygoogle|data-ad-slot|sponsor card|fake review|lorem ipsum/i,file);
  assert.match(sitemap,new RegExp('sathivo\\.co/'+file.replaceAll('.','\\.')));
 }
});
test('guides hub offers real published resources without synthetic testimonials',async()=>{
 const html=await read('guides.html');
 for(const link of ['booking-guide.html','booking-status-help.html','meetup-planner.html','companion-profile-guide.html','meet-new-friends.html','first-meeting-checklist.html','safety.html','companions.html','support.html'])
  assert.match(html,new RegExp('href="'+link.replaceAll('.','\\.')+'"'),link);
 assert.match(html,/illustrative, not a real member/i);
});
test('existing article bylines disclose their publishing organization',async()=>{
 for(const file of ['booking-guide.html','booking-status-help.html','companion-profile-guide.html','first-meeting-checklist.html','meetup-planner.html']){
  const html=await read(file);
  assert.match(html,/<p class="guide-updated">By <a href="editorial-policy\.html">Sathivo<\/a>/,file);
 }
});
test('existing Support form remains present, contact routes are real, and public legal notices remain',async()=>{
 const support=await read('support.html'),contact=await read('contact.html'),disclaimer=await read('disclaimer.html'),about=await read('about.html'),index=await read('index.html');
 assert.match(support,/id="support-form"/);
 assert.match(support,/id="support-email"/);
 assert.match(support,/id="support-message"/);
 assert.match(contact,/mailto:sathivoofficial@gmail\.com/);
 assert.match(contact,/href="support\.html"/);
 assert.match(disclaimer,/Razorpay/);
 assert.match(disclaimer,/off-platform/);
 assert.match(disclaimer,/not medical|medical/i);
 assert.match(about,/Who is behind Sathivo/);
 assert.match(about,/editorial-policy\.html/);
 assert.match(index,/href="guides\.html"/);
 assert.match(index,/href="contact\.html"/);
 assert.match(index,/href="disclaimer\.html"/);
});
test('unreviewed content ideas are kept out of the public sitemap',async()=>{
 const sitemap=await read('sitemap.xml'),plan=await read('docs/content-plan-2026-11.md');
 assert.match(plan,/P15/);
 assert.match(plan,/human editor/i);
 assert.doesNotMatch(sitemap,/docs\/content-plan|P01|P15/);
});
