import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {connectChoice} from '../js/explore-premium-filters.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('premium filters preserve directory fields and all existing option values',async()=>{
 const html=await read('companions.html'),css=await read('explore-premium-filters.css'),js=await read('js/explore-premium-filters.js');
 for(const id of ['state','district','city','city-custom','category','mode','gender-filter','sort','saved-only','city-filter-hint'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const value of ['male','female','other','online','in-person','discover','newest','price_asc','price_desc','rating'])assert.ok(html.includes('value="'+value+'"'));
 assert.match(html,/premium-filter-location-grid/);assert.match(html,/Apply Filters/);assert.match(html,/type="reset">Reset/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(js,/queueMicrotask/);assert.match(js,/select\.hidden=true/);
 assert.match(js,/form\.addEventListener\('submit',collapse\)/);
});
test('choice buttons update the actual select and dispatch one bubbling change; reset can sync',()=>{
 const select=new EventTarget();select.value='';select.disabled=false;
 const buttons=['','male','female','other'].map(value=>Object.assign(new EventTarget(),{dataset:{value},pressed:'',setAttribute(k,v){if(k==='aria-pressed')this.pressed=v;}}));
 let changes=0;select.addEventListener('change',e=>{assert.equal(e.bubbles,true);changes++;});
 const sync=connectChoice(select,{querySelectorAll:()=>buttons});
 assert.equal(buttons[0].pressed,'true');buttons[2].dispatchEvent(new Event('click'));
 assert.equal(select.value,'female');assert.equal(changes,1);assert.equal(buttons[2].pressed,'true');assert.equal(buttons[0].pressed,'false');
 buttons[2].dispatchEvent(new Event('click'));assert.equal(changes,1);
 select.value='';sync();assert.equal(buttons[0].pressed,'true');assert.equal(buttons[2].pressed,'false');
});
