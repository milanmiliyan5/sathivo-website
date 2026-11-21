import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const publicPages=xml=>[...xml.matchAll(/<loc>https:\/\/sathivo\.co\/([^<]*)<\/loc>/g)].map(m=>m[1]||'index.html');
const essential=['about.html','how-it-works.html','safety.html','privacy.html','terms.html','contact.html'];
test('every indexed public page has working links to all six essential trust pages',async()=>{
 const paths=publicPages(await read('sitemap.xml'));
 assert.ok(paths.length>=20,'substantial public website');
 for(const name of paths){
   const html=await read(name),footer=html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0];
   assert.ok(footer,name+' missing footer');
   for(const link of essential){
     assert.ok(footer.includes('href="'+link+'"'),name+': footer missing '+link);
     await stat(new URL('../'+link,import.meta.url));
   }
   assert.match(footer,/href="guides\.html"/,name+' missing guides');
   assert.doesNotMatch(footer,/href="#"/,name+' empty footer link');
 }
});
test('outdated Android coming-soon teaser removed and guides header links directly to pages',async()=>{
 const html=await read('index.html');
 assert.doesNotMatch(html,/Sathivo for Android is coming soon/i);
 assert.match(html,/<nav id="navigation"/);
 assert.match(html,/href="guides\.html">Guides<\/a>/);
 assert.match(html,/href="how-it-works\.html">How it works<\/a>/);
 assert.match(html,/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
 assert.match(await read('js/ads-config.js'),/enabled:false/);
});
test('Contact Us has real support form wired to existing handler, not an invented email address',async()=>{
 const html=await read('contact.html');
 for(const id of ['support-form','support-status','support-email','support-category','support-subject','support-message'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/js\/support-page\.js/);
 assert.match(html,/supabase-2\.116\.0\.js/);
 assert.match(html,/mailto:sathivoofficial@gmail\.com/);
 assert.doesNotMatch(html,/mailto:support@sathivo\.co/);
 const script=await read('js/support-page.js');
 assert.match(script,/submit-support/);
 assert.match(script,/support-form/);
});
test('Google third-party advertising cookie disclosures are explicit and useful',async()=>{
 const c=await read('privacy.html');
 assert.match(c,/third-party advertising vendors/);
 assert.match(c,/may place or read cookies/);
 assert.match(c,/web beacons, IP addresses/);
 assert.match(c,/myadcenter\.google\.com/);
 assert.match(c,/consent controls/);
 assert.match(c,/doubleclick\.net/);
});
test('two new practical guides are substantive, indexable and linked from the guide hub',async()=>{
 const sitemap=await read('sitemap.xml'),hub=await read('guides.html'),home=await read('index.html');
 for(const name of ['new-in-town-guide.html','public-meeting-etiquette.html']){
   const html=await read(name);
   const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
   assert.ok(text.split(' ').length>=800,name+': article too thin');
   assert.ok((html.match(/<section>/g)||[]).length>=9,name+': insufficient practical sections');
   assert.match(html,/name="robots" content="index,follow/);
   assert.ok(html.includes('rel="canonical" href="https://sathivo.co/'+name+'"'));
   assert.match(html,/href="editorial-policy\.html"/);
   assert.match(html,/href="safety\.html"/);
   assert.doesNotMatch(html,/adsbygoogle|data-ad-slot/);
   assert.ok(sitemap.includes('https://sathivo.co/'+name));
   assert.ok(hub.includes('href="'+name+'"'));
   assert.ok(home.includes('href="'+name+'"'));
 }
});
