import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindFeedbackRating} from '../js/feedback-rating.js';
test('cumulative stars follow one radio, including lower ratings and form reset',async()=>{
 const radios=Array.from({length:5},(_,i)=>{
  const classes=new Set(),listeners={};
  return {value:String(i+1),checked:false,classes,listeners,
   closest:()=>({classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}}),
   addEventListener:(name,fn)=>listeners[name]=fn};
 });
 const events={};
 const form={querySelectorAll:()=>radios,addEventListener:(name,fn)=>events[name]=fn};
 const highlighted=()=>radios.filter(r=>r.classes.has('rating-filled')).map(r=>Number(r.value));
 bindFeedbackRating(form);
 assert.deepEqual(highlighted(),[]);
 for(const n of [4,1,5,2,3]){
  radios.forEach(r=>r.checked=Number(r.value)===n);
  radios[n-1].listeners.change();
  assert.deepEqual(highlighted(),Array.from({length:n},(_,i)=>i+1));
  assert.equal(radios.filter(r=>r.checked).length,1);
 }
 events.reset();
 radios.forEach(r=>r.checked=false);
 await Promise.resolve();
 assert.deepEqual(highlighted(),[]);
});
test('feedback page loads the cumulative color style and initializes before auth',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 assert.ok((await read('feedback.html')).includes('feedback-rating.css?v=20261119-stars-1'));
 assert.ok((await read('js/feedback-page.js')).includes("bindFeedbackRating($('feedback-form'));\nvoid init();"));
 assert.ok((await read('feedback-rating.css')).includes('.rating-filled>span'));
});