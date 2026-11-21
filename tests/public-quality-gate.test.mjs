import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const sitemapPaths=xml=>[...xml.matchAll(/<loc>https:\/\/sathivo\.co\/([^<]*)<\/loc>/g)].map(m=>m[1]||'index.html');

test('sitemap contains only discoverable and meaningful public pages',async()=>{
 const sitemap=await read('sitemap.xml');
 const pages=sitemapPaths(sitemap);
 assert.equal(new Set(pages).size,pages.length,'sitemap URLs must not repeat');
 assert.ok(pages.length>=10,'publish useful public content pages');
 for(const name of pages){
  assert.match(name,/^[a-z0-9-]+\.html$|^index\.html$/i);
  const html=await read(name);
  const canonical='https://sathivo.co/'+(name==='index.html'?'':name);
  assert.ok(html.includes('rel="canonical" href="'+canonical+'"'),name+': wrong canonical');
  assert.match(html,/<meta\s+name="description"\s+content=".{25,}/i,name+': helpful description missing');
  assert.match(html,/<meta\s+name="robots"\s+content="index,follow/i,name+': not indexable');
  assert.match(html,/<h1(?:\s|>)/i,name+': missing heading');
  assert.match(html,/<main(?:\s|>)/i,name+': missing main landmark');
  assert.doesNotMatch(html,/lorem ipsum|coming soon: write|fake testimonial/i,name+': placeholder');
  for(const link of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)){
   const value=link[1];
   if(/^(?:https?:|mailto:|tel:|javascript:|data:|#)/i.test(value))continue;
   const local=value.split('#')[0].split('?')[0].replace(/^\.\//,'');
   if(!local||local==='/'||local==='.')continue;
   if(/\.html$/i.test(local))await assert.doesNotReject(()=>stat(new URL('../'+local,import.meta.url)),name+': broken link '+value);
  }
 }
});

test('member and transaction screens stay out of public search results',async()=>{
 const sitemap=await read('sitemap.xml');
 for(const name of ['account.html','profile.html','companion.html','bookings.html','chats.html','contribute.html']){
  const html=await read(name);
  assert.match(html,/<meta\s+name="robots"\s+content="noindex/i,name+' must be noindex');
  assert.ok(!sitemap.includes('sathivo.co/'+name),name+' should not be in sitemap');
 }
});

test('booking and optional contribution remain clearly distinct',async()=>{
 for(const name of ['index.html','companions.html','about.html','booking-guide.html','booking-status-help.html']){
  const html=await read(name);
  assert.match(html,/contribution/i,name+': contribution explanation missing');
  assert.match(html,/companion|booking/i,name+': booking distinction missing');
 }
 const contribute=await read('contribute.html');
 assert.match(contribute,/not a companion booking payment/i);
 assert.match(contribute,/no additional benefits/i);
});

test('directory gives guests an understandable loading and error state',async()=>{
 const html=await read('companions.html');
 assert.match(html,/id="directory-filters" open/);
 assert.match(html,/id="status"[^>]+aria-live="polite"/);
 assert.match(html,/id="retry"[^>]+type="button"/);
 assert.match(html,/id="directory-recovery"/);
 assert.match(html,/#retry:not\(\[hidden\]\)\+\.directory-recovery/);
 assert.match(html,/does not promise a particular companion/i);
 assert.match(html,/booking-status-help\.html/);
});
