import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {experienceCategoryGroups,experienceCategories,experienceLabel,experienceSafetyNote,experienceVisual,meetingModeVisual} from '../js/experience-categories.js';

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
  assert.match(html,/companions\.css\?v=20261123-explore-first-1/);
  assert.match(html,/js\/companions-page\.js\?v=20261125-top-companions-1/);
 }
 // Card and full-profile rendering must share one properly scoped component.
 assert.match(js,/tags companion-activity-tags/);
 assert.match(js,/const chip=el\('span',undefined,'companion-activity-chip'\)/);
 assert.match(js,/chip\.dataset\.activityTone=visual\.tone/);
 assert.doesNotMatch(js,/companion-activity-more|values\.slice\(0,4\)/);
 assert.doesNotMatch(js,/'more-experiences'/,'never reuse the homepage flex class on activity chips');
 const pillRule=css.match(/body\.sathivo-2d \.directory \.companion-activity-tags > \.companion-activity-chip\s*\{([^}]+)\}/)?.[1];
 const groupRule=css.match(/body\.sathivo-2d \.directory \.companion-activity-tags\s*\{([^}]+)\}/)?.[1];
 assert.ok(pillRule,'shared pill rule is present');
 assert.ok(groupRule,'shared tag wrapper is present');
 for(const rule of ['align-self:flex-start','flex:0 0 auto','height:auto','min-height:26px','max-width:100%','margin:0','border-radius:999px'])assert.ok(pillRule.includes(rule),rule);
 for(const rule of ['align-items:flex-start','align-content:flex-start','flex-wrap:wrap'])assert.ok(groupRule.includes(rule),rule);
 assert.match(css,/@media\(max-width:540px\)/);
});

test('Explore shows every published activity, including 17 selected tags, without +more',async()=>{
 const script=await read('js/companions-page.js');
 const fragment=script.slice(script.indexOf('function tags(row){'),script.indexOf('function portrait(row){'));
 assert.ok(fragment.startsWith('function tags(row){'));
 const el=(tag,text='',cls='')=>({tag,text,cls,dataset:{},attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v},append(...kids){this.children.push(...kids)}});
 const document={createTextNode:text=>({type:'text',text})};
 const context=vm.createContext({el,document,experienceLabel,experienceVisual,meetingModeVisual});
 vm.runInContext(fragment,context);
 for(const count of [0,4,15,17,21]){
  const selected=experienceCategories.slice(0,count);
  const element=vm.runInContext('tags({meeting_mode:"in-person",categories:'+JSON.stringify(selected)+'})',context);
  assert.equal(element.children.length,count+1);
  assert.equal(element.children[0].children[1].text,'In person');
  assert.deepEqual(element.children.slice(1).map(x=>x.children[1].text),selected.map(experienceLabel));
  assert.ok(element.children.every(x=>!String(x.children[1].text).includes(' more')),'No hidden activities');
 }
 const oldProfile=vm.runInContext('tags({meeting_mode:"online",categories:null})',context);
 assert.equal(oldProfile.children.length,1,'Older listings with absent categories still render');
});
test('Explore hourly amount has no rectangular outline while activity pills stay compact',async()=>{
 const js=await read('js/companions-page.js'),css=await read('companions.css');
 assert.match(js,/function cardRate\(rate\)/);
 assert.match(js,/cardRate\(row\.hourly_rate\)/);
 assert.match(js,/companion-rate-amount/);
 assert.match(css,/#results \.companion-card \.companion-card-rate\{/);
 assert.match(css,/border:0!important/);
 assert.match(css,/box-shadow:none!important/);
 assert.match(css,/min-height:26px/);
 assert.match(css,/flex-wrap:wrap/);
});

test('all 21 categories and every meeting mode have light colours and accessible icons',async()=>{
 const css=await read('experience-categories.css');
 const publicCss=await read('companions.css');
 for(const value of experienceCategories){
  const visual=experienceVisual(value);
  assert.ok(visual?.tone && visual?.icon,'Missing activity styling: '+value);
  assert.ok(css.includes('[data-activity-tone="'+visual.tone+'"]'),'Missing palette: '+visual.tone);
 }
 for(const mode of ['online','in-person','both']){
  const visual=meetingModeVisual(mode);
  assert.ok(visual?.tone&&visual?.icon,'Missing meeting mode styling: '+mode);
 }
 const profile=await read('js/profile-page.js'),publicPage=await read('js/companions-page.js');
 assert.match(profile,/label\.dataset\.activityTone=visual\.tone/);
 assert.match(profile,/input\.name='categories';input\.value=value/);
 assert.match(publicPage,/chip\.dataset\.activityTone=visual\.tone/);
 assert.match(publicCss,/\.companion-activity-chip\[data-activity-tone\]/);
 assert.match(css,/label\[data-activity-tone\]:has\(input:checked\)/);
});

test('Explore begins with compact Top Companions and filter controls, followed by real profiles',async()=>{
 const html=await read('companions.html');
 const css=await read('companions.css');
 const main=html.split('<main id="main" class="container directory directory-explore-first">')[1];
 assert.ok(main,'Explore-first main wrapper');
 const headingAt=main.indexOf('<h1 id="explore-title" class="explore-sr-only">Explore Companions</h1>');
 const filtersAt=main.indexOf('<details class="directory-filter-disclosure" id="directory-filters">');
 const resultsAt=main.indexOf('<section id="results"');
 assert.ok(headingAt>=0&&filtersAt>headingAt&&resultsAt>filtersAt);
 assert.doesNotMatch(main,/Find company for your favourite activities\./);
 assert.match(main,/href="top-companions\.html"/);
 assert.match(main,/<summary><span class="directory-filter-copy"><strong>Filter companions<\/strong>/);
 assert.doesNotMatch(main.slice(0,filtersAt),/A LITTLE COMPANY|New to Sathivo|Want to earn as a companion/);
 assert.match(main,/<form id="filters" class="filters">/);
 for(const field of ['state','district','category','mode','gender-filter','sort','saved-only'])assert.match(main,new RegExp('id="'+field+'"'));
 assert.match(main,/id="results" tabindex="-1" class="companion-grid"/);
 assert.ok(main.indexOf('directory-explainer')>resultsAt,'Useful SEO and safety guides remain below results');
 assert.match(css,/#directory-filters>summary\{[\s\S]*?display:flex/);
 assert.match(css,/directory-explore-first #status/);
 assert.match(css,/directory-explore-first #results/);
});
