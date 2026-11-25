import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('public gender is an optional publishing choice and filter uses public value only',()=>{const pub=read('js/listing-publish.js'),browse=read('js/companions-page.js');assert.match(pub,/public_gender:showGender&&\['male','female','other'\]\.includes\(p.gender\)\?p.gender:null/);assert.ok(browse.includes("p_gender:savedView?null:($('gender-filter').value||null)"));assert.match(browse,/\[row.public_gender\]/);assert.match(read('profile.html'),/id="public-gender-consent"/);});
