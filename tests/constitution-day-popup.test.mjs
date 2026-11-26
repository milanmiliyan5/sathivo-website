import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {START,END,DELAY,isActive,canShow} from '../js/constitution-day-popup.js';
test('exact India date and seven second delay',()=>{
 assert.equal(START,Date.parse('2026-11-25T18:30:00Z'));
 assert.equal(END,Date.parse('2026-11-26T18:30:00Z'));
 assert.equal(DELAY,7000);assert.equal(isActive(START-1),false);assert.equal(isActive(START),true);assert.equal(isActive(END-1),true);assert.equal(isActive(END),false);
});
test('defer during another modal, hidden page, splash or input',()=>{
 const empty={classList:{contains:()=>false}};
 const doc={hidden:false,visibilityState:'visible',body:empty,documentElement:empty,querySelector:()=>null,activeElement:{matches:()=>false}};
 assert.equal(canShow(doc,{hash:''}),true);
 assert.equal(canShow({...doc,querySelector:()=>({})},{hash:''}),false);
 assert.equal(canShow({...doc,hidden:true},{hash:''}),false);
 assert.equal(canShow({...doc,activeElement:{matches:()=>true}},{hash:''}),false);
 assert.equal(canShow(doc,{hash:'#login'}),false);
 assert.equal(canShow({...doc,documentElement:{classList:{contains:k=>k==='sathivo-entry-pending'}}},{hash:''}),false);
});
test('one-time local storage, expiry, animation cancellation and approved copy',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const s=await read('js/constitution-day-popup.js');
 for(const word of ['equality','dignity','freedom','respect','Continue to Sathivo','Happy Constitution Day!','Samvidhan Diwas'])assert.ok(s.includes(word));
 assert.match(s,/localStorage\.setItem\(KEY,'1'\)/);assert.match(s,/END-Date\.now\(\)/);
 assert.match(s,/cancelAnimationFrame/);assert.match(s,/prefers-reduced-motion/);
 assert.doesNotMatch(s,/getSathivoClient|functions\.invoke|fetch\(/);
 for(const p of ["index.html","companions.html","account.html","profile.html","requests.html","bookings.html","chats.html","notifications.html"])assert.match(await read(p),/js\/constitution-day-popup\.js\?v=20261126-1/);
 for(const p of ['admin.html','chat.html'])assert.doesNotMatch(await read(p),/constitution-day-popup/);
});
