import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('public navigation and new guide are reachable and consistent with sitemap',async()=>{
 const site=await read('sitemap.xml');
 const urls=[...site.matchAll(/<loc>https:\/\/sathivo\.co\/([^<]*)<\/loc>/g)].map(x=>x[1]);
 assert.ok(urls.includes('booking-status-help.html'));
 for(const url of urls){
  if(!url)continue;
  const html=await read(url);
  assert.match(html,/<title>[^<]+<\/title>/i,url);
  assert.match(html,/<h1\b/i,url);
  assert.doesNotMatch(html,/lorem ipsum|coming soon: write|fake testimonial/i,url);
 }
});
test('directory is accessible on mobile and does not wait for user login',async()=>{
 const html=await read('companions.html'),source=await read('js/companions-page.js'),css=await read('companions.css');
 assert.match(html,/id="directory-filters" open/);
 assert.match(html,/<summary>Filter companions/);
 assert.match(html,/<noscript>/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.ok(source.indexOf('if(directory)await list()')<source.lastIndexOf('client=await getSathivoClient()'));
 assert.match(source,/disclosure\.open=false/);
 assert.match(source,/scrollToDirectoryResults/);
 assert.match(source,/publicClient\.rpc\('browse_public_companions_v3'/);
});
