import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isActive,START,END,DELAY} from '../js/mens-day-popup.js';
test('Men’s Day is exactly Nov 19 2026 in India, expires at midnight',()=>{
 assert.equal(START,Date.parse('2026-11-18T18:30:00Z'));
 assert.equal(END,Date.parse('2026-11-19T18:30:00Z'));
 assert.equal(isActive(START-1),false);
 assert.equal(isActive(START),true);
 assert.equal(isActive(END-1),true);
 assert.equal(isActive(END),false);
 assert.equal(isActive(Date.parse('2027-11-19T12:00:00Z')),false);
 assert.equal(DELAY,3000);
});
test('homepage wiring, once-per-browser storage, expiry and dialog exclusion',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 assert.match(await read('index.html'),/js\/mens-day-popup\.js/);
 assert.doesNotMatch(await read('account.html'),/mens-day-popup/);
 const src=await read('js/mens-day-popup.js');
 assert.match(src,/localStorage\.setItem\(KEY,'1'\)/);
 assert.match(src,/document\.querySelector\('dialog\[open\]'\)/);
 assert.match(src,/END-Date\.now\(\)/);
 assert.match(await read('mens-day-popup.css'),/prefers-reduced-motion/);
});
