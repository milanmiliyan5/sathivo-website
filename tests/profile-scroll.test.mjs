import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createProfileScrollReset} from '../js/profile-scroll.js';
function harness(){
 let id=0,position=900,blurred=0;
 const frames=new Map(),timers=new Map(),events=new Map(),vpEvents=new Map();
 const win={visualViewport:{addEventListener(k,f){vpEvents.set(k,f);},removeEventListener(k){vpEvents.delete(k);}},
 scrollTo(o){assert.equal(o.behavior,'instant');position=o.top;},
 requestAnimationFrame(f){frames.set(++id,f);return id;},cancelAnimationFrame(i){frames.delete(i);},
 setTimeout(f){timers.set(++id,f);return id;},clearTimeout(i){timers.delete(i);},
 addEventListener(k,f){events.set(k,f);},removeEventListener(k){events.delete(k);}};
 const doc={activeElement:{matches:()=>true,blur(){blurred++;}}};
 const flush=()=>{const current=[...frames];frames.clear();for(const [,f] of current)f();};
 return {win,doc,frames,timers,events,vpEvents,flush,get position(){return position;},set position(v){position=v;},get blurred(){return blurred;}};
}
test('section reset removes prior offset, closes keyboard and settles after layout',()=>{
 const h=harness(),scroll=createProfileScrollReset(h.win,h.doc);scroll.reset();assert.equal(h.position,0);assert.equal(h.blurred,1);
 h.position=500;h.flush();assert.equal(h.position,0);h.position=400;h.flush();assert.equal(h.position,0);
 h.position=250;h.vpEvents.get('resize')();h.flush();assert.equal(h.position,0);
 scroll.cancel();assert.equal(h.frames.size,0);assert.equal(h.events.size,0);assert.equal(h.vpEvents.size,0);assert.equal(h.timers.size,0);
});
test('user gestures and validation cancel delayed scroll resets',()=>{
 const h=harness(),scroll=createProfileScrollReset(h.win,h.doc);scroll.reset();h.events.get('touchstart')();h.position=600;h.flush();assert.equal(h.position,600);
 scroll.reset();scroll.cancel();h.position=700;h.flush();assert.equal(h.position,700);
});
test('manual tabs, back history and successful saves reset while validation retains error focus',async()=>{
 const js=await readFile(new URL('../js/profile-page.js',import.meta.url),'utf8');
 assert.match(js,/showProfileTab\(button\.dataset\.profileTab,\{record:true,resetScroll:true\}\)/);
 assert.match(js,/if\(advance\)showProfileTab\(section==='personal'\?'companion':'privacy',\{record:true,focus:true,resetScroll:true\}\)/);
 assert.match(js,/finally\{\s*\$\('fields'\)\.disabled=false;publishing\.setBusy\(false\);\s*if\(advance\)/);
 assert.match(js,/function revealProfileControl\(control\)\{\s*profileScroll\.cancel\(\)/);
 assert.match(js,/focus\(\{preventScroll:true\}\)/);
});
