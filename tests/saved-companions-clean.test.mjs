import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Saved Companions uses a separate compact renderer and existing private favorites',async()=>{
 const h=await read('companions.html'),j=await read('js/companions-page.js'),c=await read('companions.css');
 assert.match(h,/id="saved-heading"[^>]*hidden/);
 assert.match(h,/class="saved-back" href="account.html#account"/);
 assert.match(j,/rows.map\(savedView\?savedCard:card\)/);
 assert.match(j,/const savedOnly=savedView\|\|\$\('saved-only'\).checked/);
 assert.match(j,/p_public_ids:savedIds/);
 assert.match(j,/link.append\(portrait\(row\),copy\)/);
 assert.match(c,/body.saved-companions-view .explore-compact-tools/);
 assert.match(c,/body.saved-companions-view #results\{display:flex/);
 assert.match(j,/await loadFavorites\(\{strict:true\}\)/);
});
