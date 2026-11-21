import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const articles=['how-it-works.html','boundaries-guide.html','conversation-starters.html','platonic-hangout-ideas.html'];
test('new step-by-step guide and three substantive practical articles are discoverable',async()=>{
 const index=await read('index.html'),hub=await read('guides.html'),sitemap=await read('sitemap.xml');
 for(const file of articles){
  const html=await read(file);
  assert.match(hub,new RegExp('href="'+file.replace('.','\\.')+'"'),file+': missing on guides page');
  assert.match(sitemap,new RegExp('sathivo\\.co/'+file.replace('.','\\.')+'<\\/loc>'),file+': missing sitemap');
  assert.match(html,/<meta name="robots" content="index,follow/,file);
  assert.match(html,new RegExp('rel="canonical" href="https://sathivo\\.co/'+file.replace('.','\\.')+'"'),file);
  assert.match(html,/<script type="application\/ld\+json">/,file);
  assert.match(html,/<main id="main"/,file);
  assert.match(html,/<h1>/,file);
  assert.ok(html.length>10000,file+': text too short');
  assert.ok((html.match(/<section\b/g)||[]).length>=7,file+': actionable sections');
  assert.match(html,/href="editorial-policy\.html"/,file);
  assert.match(html,/href="contact\.html"/,file);
  assert.match(html,/href="privacy\.html"/,file);
  assert.match(html,/href="terms\.html"/,file);
  assert.match(html,/href="safety\.html"/,file);
  assert.doesNotMatch(html,/adsbygoogle|data-ad-slot|fake testimonial|lorem ipsum/i,file);
  for(const link of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
   const value=link[1];
   if(!value||/^(?:https?:|mailto:|tel:|#)/.test(value))continue;
   const local=value.split('#')[0].split('?')[0].replace(/^\.\//,'');
   if(local&&local.endsWith('.html'))await stat(new URL('../'+local,import.meta.url));
  }
 }
 for(const file of articles)assert.match(index,new RegExp('href="'+file.replace('.','\\.')+'"'),file+': missing on home');
});
test('new how-it-works copy does not claim blanket identity checks or automatic moderation',async()=>{
 const c=await read('how-it-works.html');
 assert.match(c,/not government identity checks/);
 assert.match(c,/not automatically mean immediate suspension/);
 assert.match(c,/Razorpay/);
 assert.match(c,/platonic/);
 assert.match(c,/public venue/);
 assert.doesNotMatch(c,/Browse Verified Companions|verified, friendly companions|immediate account suspension/i);
});
test('trust and safety link to detailed How It Works and boundaries guides',async()=>{
 assert.match(await read('about.html'),/href="how-it-works\.html"/);
 assert.match(await read('safety.html'),/href="boundaries-guide\.html"/);
 const home=await read('index.html');
 assert.match(home,/href="how-it-works\.html"/);
});
