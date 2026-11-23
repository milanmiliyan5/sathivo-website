import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {experienceCategoryGroups,experienceCategories,experienceLabel,experienceSafetyNote} from '../js/experience-categories.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const legacy=['Conversation','Coffee','Movies','Shopping','Events','Walking','Online chat','Phone conversation'];

test('the final 21 categories are organized in the five agreed groups',()=>{
 assert.equal(experienceCategoryGroups.length,5);
 assert.deepEqual(experienceCategoryGroups.map(x=>x.title),[
  'Social & Outings','Education & Career','Everyday Help & Companionship',
  'Sports & Hobbies','Online & Remote',
 ]);
 assert.deepEqual(experienceCategoryGroups.map(x=>x.items.length),[7,4,5,3,2]);
 assert.equal(experienceCategories.length,21);
 assert.equal(new Set(experienceCategories).size,21);
 for(const value of legacy)assert.ok(experienceCategories.includes(value),value);
 assert.equal(experienceLabel('Online chat'),'Online Chat');
 assert.equal(experienceLabel('Phone conversation'),'Phone Conversation');
});

test('profile form and Explore use the same categories and preserve published values',async()=>{
 const profile=await read('js/profile-page.js');
 const browse=await read('js/companions-page.js');
 const html=await read('profile.html');
 assert.match(profile,/from '\.\/experience-categories\.js/);
 assert.match(profile,/for\(const \[index,group\] of experienceCategoryGroups\.entries\(\)\)/);
 assert.match(profile,/input\.name='categories';input\.value=value/);
 assert.match(profile,/updateCategoryGroupCounts\(\)/);
 assert.match(profile,/p\.categories\.includes\(input\.value\)/);
 assert.match(html,/id="categories"/);
 assert.match(html,/experience-categories\.css/);
 assert.match(browse,/for\(const group of experienceCategoryGroups\)/);
 assert.match(browse,/document\.createElement\('optgroup'\)/);
 assert.match(browse,/new Option\(experienceLabel\(value\),value\)/);
 assert.match(browse,/p_category:\$\('category'\)\.value\|\|null/);
 assert.match(browse,/r\.categories\.forEach\(v=>category\.add\(new Option\(experienceLabel\(v\),v\)\)\)/);
 assert.match(browse,/p_category:category\.value/);
});

test('high risk categories show scoped safeguards, not healthcare or emergency promises',async()=>{
 assert.match(experienceSafetyNote('Hospital Visit Companion'),/non-medical|emergency/i);
 assert.match(experienceSafetyNote('Senior Social Companion'),/personal care|nursing/i);
 assert.match(experienceSafetyNote('College Projects Help'),/assessed work/i);
 const profile=await read('js/profile-page.js'), browse=await read('js/companions-page.js');
 assert.match(profile,/not emergency response, nursing, personal care or medical treatment/);
 assert.match(browse,/booking-category-safety/);
 assert.match(browse,/experienceSafetyNote\(category\.value\)/);
 const css=await read('experience-categories.css');
 assert.match(css,/category-group-choices/);
 assert.match(css,/booking-category-safety/);
});

test('database constraints accept 21 canonical categories without rewriting old data',async()=>{
 const sql=await read('supabase/migrations/20261122175601_expand_sathivo_companionship_to_21_categories.sql');
 for(const name of ['member_profiles_categories_check','companion_listings_categories_check','booking_requests_category_check']){
  assert.match(sql,new RegExp(name));
 }
 for(const value of experienceCategories) assert.ok(sql.includes("'"+value+"'::text"),value);
 assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:public\.)?(?:booking_requests|booking_messages|member_profiles|companion_listings)\b/i);
});

test('all public companion chips use isolated, non-stretching pill styling across pages',async()=>{
 const js=await read('js/companions-page.js');
 const css=await read('companions.css');
 for(const page of ['companions.html','companion.html']){
  const html=await read(page);
  assert.match(html,/companions\.css\?v=20261123-activity-pills-2/);
  assert.match(html,/js\/companions-page\.js\?v=20261123-activity-pills-2/);
 }
 // Card and full-profile rendering must share one properly scoped component.
 assert.match(js,/tags companion-activity-tags/);
 assert.match(js,/visible\.forEach\(v=>n\.append\(el\('span',v,'companion-activity-chip'\)\)\)/);
 assert.match(js,/companion-activity-chip companion-activity-more/);
 assert.doesNotMatch(js,/'more-experiences'/,'never reuse the homepage flex class on activity chips');
 const pillRule=css.match(/body\.sathivo-2d \.directory \.companion-activity-tags > \.companion-activity-chip\s*\{([^}]+)\}/)?.[1];
 const groupRule=css.match(/body\.sathivo-2d \.directory \.companion-activity-tags\s*\{([^}]+)\}/)?.[1];
 assert.ok(pillRule,'shared pill rule is present');
 assert.ok(groupRule,'shared tag wrapper is present');
 for(const rule of ['align-self:flex-start','flex:0 0 auto','height:auto','min-height:32px','max-width:100%','margin:0','border-radius:999px'])assert.ok(pillRule.includes(rule),rule);
 for(const rule of ['align-items:flex-start','align-content:flex-start','flex-wrap:wrap'])assert.ok(groupRule.includes(rule),rule);
 assert.match(css,/@media\(max-width:540px\)/);
});
