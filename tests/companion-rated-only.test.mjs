import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/companions-page.js',import.meta.url),'utf8');
const el=(tag,text,cls)=>({tag,text,cls,children:[],append(...nodes){this.children.push(...nodes)},get childElementCount(){return this.children.length},setAttribute(){}});
const context=vm.createContext({el});
vm.runInContext(source.slice(source.indexOf('function hasCompanionRating('),source.indexOf('async function withCompletedCounts(')),context);
const render=row=>context.experienceAndRating(row);
test('Unrated or invalid ratings never render a star chip or empty row',()=>{
 for(const row of [{},{review_count:0,average_rating:null},{review_count:0,average_rating:5},{review_count:1,average_rating:null},{review_count:1,average_rating:0},{review_count:1,average_rating:6}]){
  assert.equal(render(row),null);
  const withBadge=render({...row,completed_count:0});
  assert.equal(withBadge.children.length,1);
  assert.match(withBadge.children[0].cls,/completed-booking-badge/);
 }
});
test('First genuine rating renders without altering completion badge',()=>{
 const row=render({review_count:1,average_rating:4.5,public_id:'abc',completed_count:1});
 assert.equal(row.children.length,2);
 assert.equal(row.children[1].text,'★ 4.5 · 1 review');
 assert.match(row.children[1].href,/#ratings-and-reviews$/);
});
