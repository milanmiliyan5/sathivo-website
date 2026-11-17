import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('public discovery hides numerical result counts and preserves pagination',()=>{
 const js=readFileSync(new URL('../js/companions-page.js',import.meta.url),'utf8');
 assert.doesNotMatch(js,/'Showing '\s*\+\s*rows\.length/);
 assert.match(js,/Explore companions · /);
 assert.match(js,/p_offset:page\*24/);
 assert.match(js,/\$\('next'\)\.disabled=all\.length<=24/);
 assert.match(js,/\$\('previous'\)\.disabled=page===0/);
});
