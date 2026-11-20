import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeCustomAmount,bindCustomAmountLimit} from '../js/contribution-amount.js';

test('custom contribution caps typing and pasted amounts at 10000',()=>{
 for(const value of ['10001','99999','1000000000000','9'.repeat(200)])
  assert.equal(normalizeCustomAmount(value),'10000');
 for(const value of ['','1','10','25','9999','10000'])
  assert.equal(normalizeCustomAmount(value),value);
 assert.equal(normalizeCustomAmount('00010'),'10');
 for(const value of ['-10','10.5','1e5','₹100','abc'])
  assert.equal(normalizeCustomAmount(value,'25'),'25');
});
test('input handler applies the limit immediately and permits editing',()=>{
 const field=new EventTarget();
 field.value='';
 bindCustomAmountLimit(field);
 for(const [typed,expected] of [['10','10'],['10000','10000'],['100000','10000'],['',''],['500','500'],['500.1','500'],['999999999999','10000']]){
  field.value=typed;
  field.dispatchEvent(new Event('input'));
  assert.equal(field.value,expected);
 }
});
test('contribution page uses numeric keyboard, immediate constraint and server-side range guard',async()=>{
 const html=await readFile(new URL('../contribute.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../js/contribution-page.js',import.meta.url),'utf8');
 assert.match(html,/id="custom-amount" inputmode="numeric" type="text"/);
 assert.ok(html.includes('Custom amount (₹10–₹10,000)'));
 assert.ok(js.includes("bindCustomAmountLimit($('custom-amount'))"));
 assert.ok(js.includes('n<10||n>10000'));
 assert.ok(js.includes("$('custom-amount').disabled=!custom"));
});
