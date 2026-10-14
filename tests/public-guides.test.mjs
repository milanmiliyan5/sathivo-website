import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const pages=['booking-guide.html','companion-profile-guide.html','first-meeting-checklist.html'];

test('original public guides are substantive and linked from homepage',async()=>{
  const home=await read('index.html');
  const sitemap=await read('sitemap.xml');
  assert.match(home,/id="guides"/);
  assert.match(home,/href="guides\.css\?v=20261014-1"/);
  for(const file of pages){
    const html=await read(file);
    assert.match(home,new RegExp('href="'+file+'"'));
    assert.ok(html.length>7000,file+' should provide more than thin landing-page copy');
    assert.ok((html.match(/<section\b/g)||[]).length>=7,file+' needs actionable sections');
    assert.match(html,/<meta name="robots" content="index,follow/);
    assert.match(html,new RegExp('https://sathivo\\.co/'+file.replace('.','\\.')));
    assert.doesNotMatch(html,/adsbygoogle|data-ad-slot/,'guides must remain readable without ads');
    assert.match(sitemap,new RegExp('https://sathivo\\.co/'+file.replace('.','\\.')));
  }
});

test('private UI remains noindex and ad preview placements stay disabled during review',async()=>{
  const directory=await read('companions.html');
  const chats=await read('chats.html');
  const config=await read('js/ads-config.js');
  assert.match(directory,/name="robots" content="noindex"/);
  assert.match(chats,/name="robots" content="noindex"/);
  assert.match(directory,/booking-guide.html/);
  assert.match(config,/enabled:false/);
  assert.match(config,/testMode:true/);
});
