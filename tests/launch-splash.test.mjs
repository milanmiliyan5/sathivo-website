import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Launch artwork matches Android and transitions by fading, never zooming',async()=>{
 const [css,js]=await Promise.all([read('launch-splash.css'),read('js/launch-splash.js')]);
 assert.match(css,/animation:sathivo-splash-dissolve 2200ms/);
 assert.match(css,/@keyframes sathivo-splash-dissolve/);
 assert.match(css,/100%\{opacity:0;/);
 assert.doesNotMatch(css,/transform:scale\(/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(js,/sessionStorage\.getItem\(SEEN\)/);
 assert.match(js,/sessionStorage\.setItem\(SEEN,'1'\)/);
 assert.match(js,/screen\.addEventListener\('animationend'/);
 assert.match(js,/fallback=setTimeout\(remove,durationMs\+500\)/);
 assert.match(js,/window\.addEventListener\('pagehide',remove/);
 assert.match(js,/M47 21 C33 -2 8 8 8 27/);
 assert.match(js,/M92 25 C91 2 59 1 55 21/);
 assert.match(js,/Find your kind of company\./);
});

test('Splash initializes first in body across public pages but not admin',async()=>{
 const pages=(await readdir(new URL('../',import.meta.url))).filter(name=>name.endsWith('.html'));
 for(const file of pages){
  const html=await read(file);
  if(file==='admin.html'){
   assert.doesNotMatch(html,/js\/launch-splash\.js/);
   continue;
  }
  assert.match(html,/launch-splash\.css\?v=(?:20261122-fade-1|20261125-entry-handoff-1)/);
  assert.match(html,/js\/launch-splash\.js\?v=(?:20261122-fade-1|20261125-entry-handoff-1)/);
  assert.match(html,/<body\b[^>]*>\s*<script src="js\/launch-splash\.js\?v=(?:20261122-fade-1|20261125-entry-handoff-1)"><\/script>/i,
    'Splash must run before other page content in '+file);
 }
});
