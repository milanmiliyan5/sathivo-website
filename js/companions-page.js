import {experienceCategoryGroups,experienceLabel,experienceSafetyNote,experienceVisual,meetingModeVisual} from './experience-categories.js?v=20261123-pastels-1';
import {getSathivoClient,getSathivoPublicClient} from './supabase-client.js?v=20261025-polish-1';
import {sendBookingPush} from './push-events.js?v=20261004-1';
import {avatarAsset} from './avatar-utils.js?v=20261121-avatars-1';
import {openSafetyReport,confirmSafetyBlock} from './safety-actions.js?v=20261018-1';
import {districtsByState,statesAndUTs,popularIndianCities} from './india-districts.js?v=20261015-1';

const $=id=>document.getElementById(id),directory=!!$('filters');
// The booking view is a separate, directly navigable URL, not an inline form.
const bookingView=!directory&&!!$('detail')&&new URLSearchParams(location.search).get('view')==='booking';
function bookingPageUrl(publicId){
 return 'companion.html?id='+encodeURIComponent(publicId)+'&view=booking';
}
function profilePageUrl(publicId){
 return 'companion.html?id='+encodeURIComponent(publicId);
}
if(bookingView){
 document.body.classList.add('booking-page-view');
 document.title='Booking Details — Sathivo';
 $('detail').classList.remove('detail-card');
 $('detail').classList.add('booking-page-content');
 const back=$('main')?.querySelector(':scope > a.text-link');
 const id=new URLSearchParams(location.search).get('id')||'';
 if(back){back.textContent='← Back to profile';back.href=profilePageUrl(id);}
 $('status').textContent='Loading booking details…';
}
const savedView=directory&&new URLSearchParams(location.search).get('saved')==='1';
if(savedView){
 document.body.classList.add('saved-companions-view');
 document.title='Saved Companions — Sathivo';
 $('saved-heading').hidden=false;$('explore-title').hidden=true;
 $('saved-only').checked=true;$('results').setAttribute('aria-label','Saved companions');
}
const fields='public_id,display_name,bio,location_id,city_name,languages,interests,categories,meeting_mode,availability,hourly_rate,photo_path,safety_id,joined_at,email_verified_at,adult_confirmed,boundaries_accepted,public_gender';
let client,publicClient,locations=[],locationsLoaded=false,page=0,request=0,currentUser=null,favoriteIds=new Set(),citySuggestionRequest=0,authStarted=false,filtersReady=false;

// One seed per page visit. Keyset cursors keep the order stable without
// repeating earlier profiles if another member publishes or hides mid-browse.
const discoverSeed=directory?Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>n.toString(16).padStart(2,'0')).join(''):'';
let discoverCursors=new Map(),directoryFilterKey='';
let detailAuthReady=false;
let favoritesLoaded=false;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function opts(id,rows,title){$(id).replaceChildren(new Option(title,''));rows.forEach(([v,t])=>$(id).add(new Option(t,String(v))));}
const normalized=value=>String(value||'').trim().toLocaleLowerCase('en-IN');
function matching(){return locations.filter(r=>(!$('state')?.value||r.state===$('state').value)&&(!$('district')?.value||r.district===$('district').value));}
function selectedLocationIds(){
 if(!directory)return null;
 if($('state').value||$('district').value)return matching().map(r=>r.id);
 return null;
}
function selectedCity(){
 if(!directory)return '';
 return $('city').value==='__other__'?$('city-custom').value.trim():$('city').value.trim();
}
function syncCitySearch(){
 const custom=$('city').value==='__other__';
 $('city-custom').hidden=!custom;
 if(!custom)$('city-custom').value='';
}
async function refreshCitySuggestions(){
 const seq=++citySuggestionRequest,select=$('city');
 if(!select)return;
 const state=$('state').value,district=$('district').value;
 let names=[];
 if(!state)names=[...popularIndianCities];
 else{
   try{
     const ids=selectedLocationIds();
     if(ids?.length){
       const {data,error}=await publicClient.rpc('browse_public_city_suggestions',{p_location_ids:ids});
       if(!error)names=(data||[]).map(r=>r.city_name).filter(Boolean);
     }
   }catch{}
 }
 if(seq!==citySuggestionRequest)return;
 const filtered=[...new Set(names)].sort((a,b)=>a.localeCompare(b,'en-IN'));
 opts('city',filtered.map(name=>[name,normalized(name)==='bengaluru'?'Bengaluru (Bangalore)':name]),'All cities / towns');
 select.add(new Option('Other city / town — type to search','__other__'));
 $('city-custom').value='';$('city-custom').hidden=true;
 $('city-filter-hint').textContent=state
   ? district?'Cities with published companions in '+district+'. Or type another city.':'Cities with published companions in '+state+'. Or type another city.'
   : 'Top 25 popular Indian cities. Choose a state for local suggestions.';
}
function districts(){
 const state=$('state').value;
 opts('district',(districtsByState[state]||[]).map(v=>[v,v]),state?'All districts in '+state:'Choose a state first');
 $('district').disabled=!state;
 $('city').value='';$('city-custom').value='';$('city-custom').hidden=true;
 void refreshCitySuggestions();
}
function locationName(id,cityName=''){
 const r=locations.find(r=>r.id===id);if(!r)return cityName||'Location unavailable';
 const city=String(cityName||'').trim();
 if(city&&normalized(city)!==normalized(r.district))return [city,r.district,r.state].join(' · ');
 if(r.city!=='District-wide'&&r.city&&normalized(r.city)!==normalized(r.district))return [r.city,r.district,r.state].join(' · ');
 return [r.district,r.state].join(' · ');
}
function scopeName(){
 if(!directory)return '';
 const city=selectedCity();
 if(city)return [city,$('district').value,$('state').value||'India'].filter(Boolean).join(' · ');
 if($('district').value)return $('district').value+' · '+($('state').value||'India');
 if($('state').value)return $('state').value;
 return 'All India';
}
function tags(row){
 // Always show the actual published selections on Explore and profile pages.
 // No "+N more" truncation: compact wrapping is entirely handled by CSS.
 const n=el('div',undefined,'tags companion-activity-tags');
 const selected=Array.isArray(row.categories)?row.categories:[];
 const modeLabel={'online':'Online','in-person':'In person','both':'Online & in person'}[row.meeting_mode];
 const values=[...(modeLabel?[{label:modeLabel,visual:meetingModeVisual(row.meeting_mode)}]:[]),
   ...selected.map(value=>({label:experienceLabel(value),visual:experienceVisual(value)}))];
 for(const {label,visual} of values){
  const chip=el('span',undefined,'companion-activity-chip');
  chip.dataset.activityTone=visual.tone;
  const icon=el('i',undefined,'companion-activity-icon');
  icon.setAttribute('aria-hidden','true');
  icon.innerHTML=activityOutline(label);
  chip.append(icon,document.createTextNode(label));
  n.append(chip);
 }
 return n;
}
// Match the homepage's classic 21 activity SVGs. Only trusted static shapes enter markup.
function activityOutline(label){
 const shapes={
  "Conversation": "<path d=\"M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z\"/><path d=\"M8 12h.01M12 12h.01M16 12h.01\" stroke-width=\"2.6\"/>",
  "Coffee": "<path d=\"M3 8h15v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM18 9h1a3 3 0 0 1 0 6h-1M2 22h19M7 2v3m4-3v3m4-3v3\"/>",
  "Movies": "<rect x=\"3\" y=\"9\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M3 9 2 5l17-3 1 4L3 9Zm4-5 3 4m4-5 3 4M3 13h18\"/>",
  "Shopping": "<path d=\"M5 7h14l2 14H3L5 7Z\"/><path d=\"M9 10V6a3 3 0 0 1 6 0v4\"/>",
  "Events": "<path d=\"M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4zM15 5v3m0 3v2m0 3v3\"/>",
  "Walking": "<circle cx=\"13\" cy=\"4\" r=\"2\"/><path d=\"m8 21 3-7 3 2 2 5m-5-7 1-6m0 0 4 4h4m-8-4-4 3-2 4\"/>",
  "City Exploration": "<path d=\"M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z\"/><circle cx=\"12\" cy=\"10\" r=\"2.5\"/>",
  "College Projects Help": "<path d=\"m2 8 10-5 10 5-10 5L2 8Zm4 2v7c4 3 8 3 12 0v-7m4-2v8\"/>",
  "Study Partner": "<path d=\"M12 6C9 4 5 4 2 5v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-3-1-7-1-10 1Zm0 0v14\"/>",
  "Language Practice": "<path d=\"M3 5h13v10H9l-4 4v-4H3zM16 8h5v11h-3l-3 3v-3h-3v-4M6 9h7m-7 3h4\"/>",
  "Interview Practice": "<rect x=\"9\" y=\"2\" width=\"6\" height=\"13\" rx=\"3\"/><path d=\"M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8\"/>",
  "Digital Help": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"13\" rx=\"2\"/><path d=\"m4 16-2 4h20l-2-4M10 18h4\"/>",
  "New City Buddy": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z\"/>",
  "Hospital Visit Companion": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M12 6v6m-3-3h6M9 21v-5h6v5M3 21h18\"/>",
  "Appointment Companion": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 3v4m10-4v4M3 10h18m-12 6 2 2 4-4\"/>",
  "Senior Social Companion": "<path d=\"M20.5 8.5c0 4-8.5 9-8.5 9s-8.5-5-8.5-9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2Z\"/><path d=\"m3 20 4-2m14 2-4-2\"/>",
  "Sports & Fitness Partner": "<path d=\"M3 9v6m3-9v12m12-12v12m3-9v6M6 12h12\"/>",
  "Gaming Partner": "<path d=\"M7 7h10c3 0 4 2 5 7l.5 3c.3 2-2 3-3.5 1.5L15 15H9l-4 3.5C3.5 20 1.2 19 1.5 17l.5-3c1-5 2-7 5-7Z\"/><path d=\"M6 11v4m-2-2h4m8-1h.01m3 2h.01\" stroke-width=\"2\"/>",
  "Photography & Creative Partner": "<path d=\"M3 7h4l2-3h6l2 3h4v13H3z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/>",
  "Online Chat": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"14\" rx=\"3\"/><path d=\"m7 18-3 3v-3m3-7h.01m5 0h.01m5 0h.01\" stroke-width=\"2\"/>",
  "Phone Conversation": "<path d=\"M5 3h4l2 5-3 2c1 3 3 5 6 6l2-3 5 2v4c0 2-2 2-3 2C10 20 4 14 3 6c0-1 0-3 2-3Z\"/>",
  "Online": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"13\" rx=\"2\"/><path d=\"m4 16-2 4h20l-2-4M10 18h4\"/>",
  "In person": "<path d=\"M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z\"/><path d=\"M8 12h.01M12 12h.01M16 12h.01\" stroke-width=\"2.6\"/>",
  "Online & in person": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M8 21h8m-4-4v4M7 10h10m-5-4v8\"/>"
};
 const shape=Object.hasOwn(shapes,label)?shapes[label]:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8m-4-4h8"/>';
 return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b2146" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true" style="display:block">'+shape+'</svg>';
}
function portrait(row){
 const initial=row.display_name.slice(0,1).toUpperCase(),n=el('div',initial,'portrait');
 if(!row.photo_path)return n;
 const builtIn=avatarAsset(row.photo_path);
 if(builtIn){const img=el('img');img.alt=row.display_name+' — profile avatar';img.loading='lazy';img.src=builtIn;n.classList.add('is-builtin-avatar');n.replaceChildren(img);return n;}
 void publicClient.storage.from('listing-photos').createSignedUrl(row.photo_path,60).then(({data,error})=>{if(error||!data)return;const img=el('img');img.alt=row.display_name+' — profile photo';img.loading='lazy';img.src=data.signedUrl;img.onerror=()=>n.replaceChildren(document.createTextNode(initial));n.replaceChildren(img);}).catch(()=>{/* Keep the initial if the image request fails. */});
 return n;
}
function trustChips(row,compact=false){const n=el('div',undefined,'trust-chips'+(compact?' compact':''));if(row.email_verified_at)n.append(el('span','✓ Email verified'));if(row.adult_confirmed)n.append(el('span','18+ self-declared'));if(row.boundaries_accepted)n.append(el('span','Platonic boundaries'));return n;}
function rateText(rate){return Number(rate)>0?'₹'+Number(rate).toLocaleString('en-IN')+' / hour':'Rate not set'}
function cardRate(rate){
 const n=el('strong',undefined,'rate-chip companion-card-rate');
 const amount=Number(rate);
 if(Number.isFinite(amount)&&amount>0){
  n.append(el('span','₹'+amount.toLocaleString('en-IN'),'companion-rate-amount'),el('span','/ hour','companion-rate-unit'));
 }else n.textContent='Rate not set';
 return n;
}
function totalFor(rate,minutes){return Number(rate)>0?Math.round(Number(rate)*Number(minutes)/60):null}
function hasCompanionRating(row){
 const n=Number(row.review_count),stars=Number(row.average_rating);
 return Number.isSafeInteger(n)&&n>0&&Number.isFinite(stars)&&stars>=1&&stars<=5;
}
function ratingText(row){const n=Number(row.review_count);return hasCompanionRating(row)?'★ '+Number(row.average_rating).toFixed(1)+' · '+n+' review'+(n===1?'':'s'):'No reviews yet';}
function completedBookingBadge(row){
 const raw=row.completed_count;
 if(raw===null||raw===undefined)return null; // Never mislabel a failed lookup as 0.
 const count=Number(raw);
 if(!Number.isSafeInteger(count)||count<0)return null;
 const text=count===0?'Newly Joined':count+' Booking'+(count===1?'':'s')+' Done';
 const badge=el('span',text,'completed-booking-badge'+(count===0?' newly-joined':''));
 badge.setAttribute('aria-label',count===0?'No completed bookings yet':text);
 return badge;
}
function experienceAndRating(row){
 const wrap=el('div',undefined,'experience-rating-row');
 const badge=completedBookingBadge(row);if(badge)wrap.append(badge);
 if(hasCompanionRating(row)){
  const link=el('a',ratingText(row),'public-rating-link');
  link.href='companion.html?id='+encodeURIComponent(row.public_id)+'#ratings-and-reviews';
  link.setAttribute('aria-label',ratingText(row)+' — read ratings and reviews');
  wrap.append(link);
 }
 return wrap.childElementCount?wrap:null;
}
async function withCompletedCounts(rows){
 const ids=[...new Set(rows.map(row=>row.public_id).filter(Boolean))];
 if(!ids.length)return rows;
 try{
  const {data,error}=await publicClient.rpc('public_companion_completed_counts',{p_public_ids:ids});
  if(error)throw error;
  const counts=new Map((data||[]).map(row=>[row.public_id,Number(row.completed_count)]));
  return withActiveMemberBadges(rows.map(row=>({...row,completed_count:counts.get(row.public_id)??null})));
 }catch(error){
  // Discovery stays available if the optional count service is offline.
  console.warn('Completed-booking badges unavailable:',error?.message||'Network error');
  return withActiveMemberBadges(rows);
 }
}

async function withActiveMemberBadges(rows){
 const ids=[...new Set(rows.map(row=>row.public_id).filter(Boolean))];
 if(!ids.length)return rows;
 try{
  const {data,error}=await publicClient.rpc('public_active_member_badges',{p_public_ids:ids});
  if(error)throw error;
  const recognized=new Set((data||[]).map(item=>item.public_id));
  return rows.map(row=>({...row,is_active_member:recognized.has(row.public_id)}));
 }catch(error){
  console.warn('Active Member badges unavailable:',error?.message||'Network error');
  return rows; // Never claim that an offline badge lookup verified a member.
 }
}
function activeMemberBadge(row){
 if(row.is_active_member!==true)return null;
 const badge=el('span','💬 Active Member','active-member-badge');
 badge.title='Recognized for community activity only. Not identity or safety verification.';
 badge.setAttribute('aria-label','Active Member community recognition, not identity verification');
 return badge;
}

async function loadFavorites({strict=false}={}){
 favoritesLoaded=false;
 if(!currentUser){favoriteIds=new Set();return;}
 const {data,error}=await client.from('companion_favorites').select('companion_public_id').eq('user_id',currentUser.id);
 if(error&&strict)throw Error('Could not load saved companions. Please try again.');
 if(!error){favoriteIds=new Set((data||[]).map(r=>r.companion_public_id));favoritesLoaded=true;}
}
function syncFavoriteButtons(publicId){
 document.querySelectorAll('[data-favorite-id="'+CSS.escape(publicId)+'"]').forEach(button=>{
  const saved=favoriteIds.has(publicId);
  button.classList.toggle('saved',saved);
  button.setAttribute('aria-pressed',String(saved));
  button.title=saved?'Remove from saved':'Save companion';
  button.setAttribute('aria-label',button.title);
  button.textContent=saved?'♥':'♡';
 });
}
async function toggleFavorite(publicId){
 if(!currentUser){location.href='account.html#login';return}
 const saved=favoriteIds.has(publicId);
 const op=saved
  ? client.from('companion_favorites').delete().eq('user_id',currentUser.id).eq('companion_public_id',publicId)
  : client.from('companion_favorites').insert({user_id:currentUser.id,companion_public_id:publicId});
 const {error}=await op;
 if(error){if(directory)$('status').textContent='Could not update saved companions. Try again.';return}
 if(saved)favoriteIds.delete(publicId);else favoriteIds.add(publicId);
 syncFavoriteButtons(publicId);
 if(directory&&$('saved-only').checked){page=0;void list();}
}
function favoriteButton(row,large=false){
 const b=el('button',favoriteIds.has(row.public_id)?'♥':'♡','favorite-button'+(large?' favorite-button-large':''));
 b.type='button';b.dataset.favoriteId=row.public_id;b.setAttribute('aria-pressed',String(favoriteIds.has(row.public_id)));b.title=favoriteIds.has(row.public_id)?'Remove from saved':'Save companion';
 b.setAttribute('aria-label',b.title);
 b.onclick=()=>void toggleFavorite(row.public_id);
 return b;
}
export function publicProfileUrl(row){
 return 'https://sathivo.co/companion.html?id='+encodeURIComponent(row.public_id);
}
export async function shareProfile(row,button){
 const url=publicProfileUrl(row);
 const data={title:row.display_name+' on Sathivo',text:'See '+row.display_name+' on Sathivo — strictly platonic companionship.',url};
 try{
  if(navigator.share){await navigator.share(data);return}
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);const old=button.textContent;button.textContent='Link copied ✓';setTimeout(()=>button.textContent=old,1600);return}
  prompt('Copy this Sathivo profile link:',url);
 }catch(error){if(error?.name!=='AbortError')prompt('Copy this Sathivo profile link:',url);}
}
function namedHeading(tag,row){
 const heading=el(tag,row.display_name),label={male:'Male',female:'Female',other:'Other'}[row.public_gender];
 if(label)heading.append(document.createTextNode(' '),el('span',label,'public-gender-chip'));
 const activity=activeMemberBadge(row);
 if(activity)heading.append(document.createTextNode(' '),activity);
 return heading;
}
function card(row){
 const n=el('article',undefined,'companion-card'),copy=el('div',undefined,'card-copy'),head=el('div',undefined,'card-heading-row'),name=namedHeading('h2',row);
 head.append(name,favoriteButton(row));
 copy.append(head);
 const experience=experienceAndRating(row);if(experience)copy.append(experience);
 copy.append(el('p',locationName(row.location_id,row.city_name)),cardRate(row.hourly_rate),trustChips(row,true),tags(row),el('p',row.bio.length>150?row.bio.slice(0,147)+'…':row.bio));
 const actions=el('div',undefined,'card-actions'),link=el('a','Get to know '+row.display_name+' ↗','text-link companion-profile-link'),share=el('button','Share ↗','text-link share-link');
 const profileHref='companion.html?id='+encodeURIComponent(row.public_id);
 link.href=profileHref;share.type='button';share.onclick=()=>void shareProfile(row,share);
 actions.append(link,share);copy.append(actions);n.append(portrait(row),copy);
 // Navigate from non-interactive areas of the card. Keep the visible link,
 // wishlist button, and Share button as independent native controls.
 n.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  if(event.target.closest('a,button,input,select,textarea,[role="button"],[role="link"]'))return;
  window.location.assign(link.href);
 });
 return n;
}
function savedCard(row){
 const n=el('article',undefined,'saved-companion-row');
 const link=el('a',undefined,'saved-companion-link');link.href='companion.html?id='+encodeURIComponent(row.public_id);
 const copy=el('div',undefined,'saved-companion-copy');
 copy.append(el('h2',row.display_name),el('p',row.city_name||locationName(row.location_id),'saved-location'));
 const activities=(Array.isArray(row.categories)?row.categories:[]).map(experienceLabel);
 if(activities.length)copy.append(el('p',activities.join(' · '),'saved-activities'));
 copy.append(el('strong',Number(row.hourly_rate)>0?'₹'+Number(row.hourly_rate).toLocaleString('en-IN')+'/hr':'Rate not set','saved-rate'));
 link.append(portrait(row),copy);
 const button=favoriteButton(row);button.classList.add('saved-row-heart');button.classList.toggle('saved',favoriteIds.has(row.public_id));
 button.setAttribute('aria-label','Remove '+row.display_name+' from saved companions');
 n.append(link,button);return n;
}
function feedNodes(rows){
 return rows.map(savedView?savedCard:card);
}
function sortLabel(){return {discover:'Discover',newest:'Newest',price_asc:'Price: low to high',price_desc:'Price: high to low',rating:'Top rated'}[$('sort')?.value]||'Discover';}
// Pagination lands at the start of the new results, not the previous scroll offset.
function scrollToDirectoryResults(hasProfiles){
 const target=hasProfiles?$('results'):($('empty').hidden?$('status'):$('empty'));
 target.focus({preventScroll:true});
 target.scrollIntoView({block:'start',inline:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function showDirectoryEmpty(kind){
 const copy={
  saved:['heart','No saved companions','Save profiles you like to find them later.','Explore companions ↗'],
  savedFiltered:['heart','No matching saved companions','Try changing your filters or explore more profiles.','Explore companions ↗'],
  search:['search','No matching companions','Try a different location or activity.','Clear filters ↗']
 }[kind];
 $('empty').dataset.emptyKind=copy[0];
 $('directory-empty-title').textContent=copy[1];
 $('directory-empty-copy').textContent=savedView?(kind==='saved'?'Save your favourite profiles here.':'Your saved profiles may no longer be available.'):copy[2];
 if(savedView&&kind==='savedFiltered')$('directory-empty-title').textContent='No available saved companions';
 $('directory-empty-action').textContent=savedView?'Explore':copy[3];
 $('status').textContent='';
 $('empty').hidden=false;
}
async function list({fromPagination=false}={}){
 const seq=++request;$('empty').hidden=true;$('retry').hidden=true;$('previous').disabled=$('next').disabled=true;$('status').textContent=savedView?'Loading saved companions…':'Finding good company…';
 if(savedView)$('saved-pagination').hidden=true;
 $('results').replaceChildren(...Array.from({length:6},()=>{const n=el('article',undefined,savedView?'saved-companion-row saved-row-skeleton':'companion-card companion-skeleton');n.innerHTML='<div class="portrait skeleton-block"></div><div class="card-copy"><i></i><i></i><i></i><i></i></div>';return n}));
 const savedOnly=savedView||$('saved-only').checked;
 if(savedOnly&&!currentUser){location.href='account.html#login';return}
 if(savedOnly&&!favoritesLoaded){
  try{await loadFavorites({strict:true});}
  catch{if(seq===request){$('results').replaceChildren();$('status').textContent='Could not load saved companions. Please try again.';$('retry').hidden=false;$('page-label').textContent='';}return;}
  if(seq!==request)return;
 }
 const savedIds=savedOnly?[...favoriteIds]:null;
 if(savedView)$('saved-count').textContent=savedIds.length+' saved';
 if(savedOnly&&!savedIds.length){$('results').replaceChildren();showDirectoryEmpty('saved');$('previous').disabled=$('next').disabled=true;$('page-label').textContent='';return}
 if(!savedView&&!locationsLoaded&&($('state').value||$('district').value)){
  $('results').replaceChildren();$('status').textContent='Location filters are temporarily unavailable. Please try again.';$('retry').hidden=false;$('page-label').textContent='';return;
 }
 const locationIds=savedView?null:selectedLocationIds();
 if(locationIds!==null&&!locationIds.length){$('results').replaceChildren();showDirectoryEmpty(savedOnly?'savedFiltered':'search');$('previous').disabled=$('next').disabled=true;$('page-label').textContent='';return;}
 try{
  const sort=savedView?'newest':($('sort').value||'discover'),discover=sort==='discover';
  const filters={
   p_location_ids:locationIds?.length?locationIds:null,
   p_city:savedView?null:(selectedCity()||null),
   p_gender:savedView?null:($('gender-filter').value||null),
   p_category:savedView?null:($('category').value||null),
   p_mode:savedView?null:($('mode').value||null),
   p_public_ids:savedIds
  };
  const filterKey=JSON.stringify([sort,filters]);
  if(filterKey!==directoryFilterKey){directoryFilterKey=filterKey;page=0;discoverCursors.clear();}
  if(discover&&page>0&&!discoverCursors.has(page))page=0;
  if(page===0)discoverCursors.clear();
  const cursor=discoverCursors.get(page);
  // Feature exactly one matching female card; explicit gender/saved filters retain ordinary shuffle.
  const featuredDiscover=discover&&!filters.p_gender&&!filters.p_public_ids;
  const {data,error}=await publicClient.rpc('browse_public_companions_v3',{
   ...filters,
   p_sort:discover?(featuredDiscover?'discover-first:':'discover:')+discoverSeed+(cursor?':'+cursor:''):sort,
   p_offset:discover?0:page*24,
   p_limit:25
  });
  if(seq!==request)return;if(error)throw error;
  const all=data||[],rows=savedView?all.slice(0,24):await withCompletedCounts(all.slice(0,24));
  if(seq!==request)return;
  if(discover){
   for(const key of discoverCursors.keys())if(key>page)discoverCursors.delete(key);
   if(all.length>24){
    // Carry the first card ID through keyset pagination so new profiles cannot reshuffle it mid-visit.
    const firstId=featuredDiscover?(page===0?all[0].public_id:cursor?.split(':')[1]):null;
    discoverCursors.set(page+1,all[23].public_id+(firstId?':'+firstId:''));
   }
  }
  $('results').replaceChildren(...feedNodes(rows));$('empty').hidden=rows.length>0;
  if(rows.length)$('status').textContent='';
  else showDirectoryEmpty(savedOnly?'savedFiltered':'search');
  $('previous').disabled=page===0;$('next').disabled=all.length<=24;$('page-label').textContent='';
  if(savedView)$('saved-pagination').hidden=page===0&&all.length<=24;
  if(fromPagination)scrollToDirectoryResults(rows.length>0);
 }catch(error){if(seq!==request)return;$('results').replaceChildren();$('status').textContent='Could not load companions. Please try again.';$('retry').hidden=false;if(fromPagination)scrollToDirectoryResults(false);}
}
// Check ownership using the verified viewer's own listing, never URL flags,
 // names, email addresses or publicly exposed account identifiers.
async function bookingAccess(r){
 if(!detailAuthReady)return 'checking';
 if(!currentUser)return 'guest';
 try{
  const {data,error}=await client.from('companion_listings').select('public_id')
   .eq('user_id',currentUser.id).eq('public_id',r.public_id).maybeSingle();
  if(error)return 'unavailable';
  return data?.public_id===r.public_id?'own':'other';
 }catch{return 'unavailable'}
}
function disabledBookingPanel(wrap,access){
 wrap.classList.add('booking-unavailable-panel');
 const own=access==='own';
 wrap.append(el('h2',own?"You're viewing your own profile":access==='checking'?'Checking booking access…':'Booking temporarily unavailable'));
 wrap.append(el('p',own?'You cannot send a booking request to yourself.':access==='checking'?'Checking your account…':'Could not verify booking access. Refresh the page to try again.'));
 const button=el('button','Send Request','button button-outline own-booking-disabled');
 button.type='button';button.disabled=true;wrap.append(button);
 return wrap;
}
// Booking dates are entered in the viewer's local timezone, then converted to ISO.
function bookingLocalParts(date){
 const pad=n=>String(n).padStart(2,'0');
 return {date:date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate()),time:pad(date.getHours())+':'+pad(date.getMinutes())};
}
function bookingLocalDate(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
 const chosen=new Date(date+'T'+time);
 if(Number.isNaN(chosen.getTime()))return null;
 const parts=bookingLocalParts(chosen);
 return parts.date===date&&parts.time===time?chosen:null;
}
function bookingMinimum(){
 // Round upward so a selectable minute is never less than 30 minutes away.
 return new Date(Math.ceil((Date.now()+30*60*1000)/60000)*60000);
}
function bookingChoices(label,name,options,initial){
 const fieldset=el('fieldset',undefined,'booking-field booking-choice-field full');
 fieldset.append(el('legend',label));
 const group=el('div',undefined,'booking-choice-group');
 const inputs=options.map(([value,text])=>{
  const lab=el('label',undefined,'booking-choice');
  const input=document.createElement('input');input.type='radio';input.name=name;input.value=value;input.required=true;input.checked=value===initial;
  lab.append(input,el('span',text));group.append(lab);return input;
 });
 fieldset.append(group);
 return {field:fieldset,inputs,get value(){return inputs.find(input=>input.checked)?.value||''}};
}
function profileBookingAction(r,access){
 const wrap=el('div',undefined,'profile-booking-action');
 if(['own','checking','unavailable'].includes(access)||!Number(r.hourly_rate)||!r.categories?.length||!['online','in-person','both'].includes(r.meeting_mode)){
  const button=el('button','Book Now','button button-outline own-booking-disabled');
  button.type='button';button.disabled=true;
  wrap.append(button);
  const reason=access==='own'?'You cannot book your own profile.':access==='checking'?'Checking booking access…':access==='unavailable'?'Booking temporarily unavailable.':'This companion is not currently available for booking.';
  wrap.append(el('p',reason,'field-hint'));
  return wrap;
 }
 const link=el('a','Book Now','button button-primary');link.href=bookingPageUrl(r.public_id);
 wrap.append(link);return wrap;
}
function bookingForm(r,access='checking'){
 const wrap=el('section',undefined,'booking-form');
 if(['own','checking','unavailable'].includes(access))return disabledBookingPanel(wrap,access);
 wrap.classList.add('booking-compact');
 wrap.append(el('h2','Booking Details'));
 if(!Number(r.hourly_rate)||!r.categories?.length||!['online','in-person','both'].includes(r.meeting_mode)){wrap.append(el('p','This companion has not set a rate yet, so new booking requests are temporarily unavailable.','payment-note'));return wrap;}
 if(access==='guest'||!currentUser){const a=el('a','Sign in to send a request ↗','button button-primary');a.href='account.html#login';wrap.append(a);return wrap;}
 const form=document.createElement('form'),grid=el('div',undefined,'booking-grid');
 const category=document.createElement('select');category.required=true;r.categories.forEach(v=>category.add(new Option(experienceLabel(v),v)));
 const modes=[];if(['online','both'].includes(r.meeting_mode))modes.push(['online','Online']);if(['in-person','both'].includes(r.meeting_mode))modes.push(['in-person','In person']);
 const mode=bookingChoices('Meeting type','booking-mode',modes,modes[0]?.[0]);
 const date=document.createElement('input'),time=document.createElement('input');
 date.type='date';time.type='time';date.required=time.required=true;time.step='60';
 const updateMinimum=()=>{
  const min=bookingLocalParts(bookingMinimum());
  date.min=min.date;
  if(date.value===min.date)time.min=min.time;else time.removeAttribute('min');
 };
 date.addEventListener('change',updateMinimum);date.addEventListener('focus',updateMinimum);time.addEventListener('focus',updateMinimum);updateMinimum();
 const duration=bookingChoices('Duration','booking-duration',[['30','30m'],['60','1 hr'],['90','90m'],['120','2 hr'],['180','3 hr']],'60');
 const offer=document.createElement('input');offer.type='number';offer.min='1';offer.max='100000';offer.step='1';offer.inputMode='numeric';offer.required=true;offer.value=String(r.hourly_rate);offer.placeholder='Hourly offer';
 const estimate=el('strong','', 'booking-total-amount');estimate.setAttribute('aria-live','polite');
 const length=el('small','', 'booking-total-duration');
 const updateEstimate=()=>{const rate=Number(offer.value),mins=Number(duration.value),valid=Number.isInteger(rate)&&rate>=1&&rate<=100000&&mins>0;estimate.textContent=valid?'₹'+totalFor(rate,mins).toLocaleString('en-IN'):'—';length.textContent=mins+' minutes';};
 offer.addEventListener('input',updateEstimate);duration.inputs.forEach(input=>input.addEventListener('change',updateEstimate));updateEstimate();
 const bookingSafety=el('p','','booking-category-safety');bookingSafety.setAttribute('role','note');
 const refreshBookingSafety=()=>{bookingSafety.textContent=experienceSafetyNote(category.value);};
 category.addEventListener('change',refreshBookingSafety);refreshBookingSafety();
 const note=document.createElement('textarea');note.maxLength=1000;note.rows=2;note.placeholder='Anything about your plan…';
 const field=(label,input,full=false,helper='')=>{const box=el('div',undefined,'booking-field'+(full?' full':'')),lab=el('label',label);lab.append(input);box.append(lab);if(helper)box.append(el('small',helper,'booking-helper'));return box;};
 const schedule=el('div',undefined,'booking-field full booking-schedule');schedule.append(field('Date',date),field('Time',time));
 grid.append(field('Activity',category,true),mode.field,schedule,duration.field,field('Hourly offer (₹)',offer,true),field('Note (optional)',note,true));
 const total=el('div',undefined,'booking-total'),amount=el('div',undefined,'booking-total-copy'),fees=el('div',undefined,'booking-total-fees');
 amount.append(el('small','Estimated total'),estimate);fees.append(el('strong','₹0 platform fee'),length);total.append(amount,fees);
 const payment=el('details',undefined,'booking-safety-details');
 payment.append(el('summary','Payment & Safety'),el('p','Sathivo does not collect, manage or process payments, hold funds, issue refunds or provide payment protection. Pay directly by UPI or cash; verify the recipient and amount. Never share UPI PINs, passwords, OTPs or your exact home address. For in-person plans, meet in a public place.'));
 form.append(grid,total,bookingSafety,el('p','Pay directly to the companion. No payment protection.','booking-payment-short'),payment);
 const row=el('div',undefined,'booking-submit-row'),b=el('button','Send Request','button button-primary'),status=el('p','', 'field-hint');b.type='submit';status.setAttribute('role','status');row.append(b,status);form.append(row,el('p','Booking confirmed only after acceptance.','booking-confirmation-note'));
 const bookingOwner=currentUser.id;
 form.onsubmit=async e=>{
  e.preventDefault();if(access!=='other'||!currentUser||b.disabled||currentUser.id!==bookingOwner)return;
  updateMinimum();
  const chosen=bookingLocalDate(date.value,time.value);
  if(!chosen||chosen<bookingMinimum()){status.textContent='Choose a date and time at least 30 minutes from now.';date.focus();return}
  if(!mode.value||!duration.value){status.textContent='Choose a meeting type and duration.';return}
  b.disabled=true;status.textContent='Sending request…';
  try{const iso=chosen.toISOString();const offerRate=Number(offer.value);
   if(!Number.isInteger(offerRate)||offerRate<1||offerRate>100000){status.textContent='Enter a valid hourly offer between ₹1 and ₹1,00,000.';offer.focus();b.disabled=false;return}
   const identity=await client.auth.getUser();if(identity.error||identity.data?.user?.id!==bookingOwner)throw Error('Sign in again before sending this request.');
   const {data,error}=await client.rpc('create_booking_request_with_offer',{p_companion_public_id:r.public_id,p_category:category.value,p_meeting_mode:mode.value,p_requested_for:iso,p_duration_minutes:Number(duration.value),p_note:note.value.trim(),p_offer_hourly_rate:offerRate});if(error)throw error;status.textContent='Request sent. Notifying the companion…';await sendBookingPush(client,data,'request');status.textContent='Request sent. Opening your bookings…';location.href='bookings.html?id='+encodeURIComponent(data)+'&booked=1'
  }catch(err){status.textContent=err.message||'Could not send request.';b.disabled=false;}
 };
 wrap.append(form);return wrap;
}
// Detail-only photo overlay. Use a sibling layer because the photo may load
// asynchronously and portrait() replaces its own children after signing its URL.
function detailPhotoFrame(row){
 const frame=el('div',undefined,'detail-photo-frame');
 const portraitNode=portrait(row);
 frame.append(portraitNode);
 const about=String(row.bio||'').trim();
 const extras=[
  ['Languages',row.languages],
  ['Interests & vibe',row.interests],
  ['Usual availability',row.availability]
 ].map(([label,value])=>[label,Array.isArray(value)?value.filter(Boolean).join(' · '):String(value||'').trim()])
  .filter(([,value])=>value.length>0);
 if(!about&&!extras.length)return frame;
 const shade=el('div',undefined,'photo-info-shade');
 shade.setAttribute('aria-hidden','true');
 const info=el('section',undefined,'photo-info');
 info.setAttribute('aria-label','About and preferences for '+row.display_name);
 info.append(el('span','A LITTLE ABOUT ME ♡','photo-info-kicker'),el('strong',about?'About Me':'At a Glance','photo-info-title'));
 const normalized=about.replace(/\s+/g,' ').trim();
 const longAbout=normalized.length>155;
 const extraLength=extras.reduce((n,[label,value])=>n+label.length+value.length,0);
 const needsMore=longAbout||extraLength>145||(normalized.length+extraLength>275);
 const addExtras=host=>{
  for(const [label,value] of extras){
   const pair=el('div',undefined,'photo-info-pair');
   pair.append(el('span',label,'photo-info-key'),el('p',value,'photo-info-value'));
   host.append(pair);
  }
 };
 if(about){
  let preview=about;
  if(longAbout){
   let truncated=normalized.slice(0,139);
   const lastSpace=truncated.lastIndexOf(' ');
   if(lastSpace>104)truncated=truncated.slice(0,lastSpace);
   preview=truncated.trimEnd()+'…';
  }
  info.append(el('p',preview,'photo-info-summary'));
 }
 if(needsMore){
  const expandable=el('details',undefined,'photo-info-expand');
  const summary=el('summary');
  summary.append(el('span','See More ↓','photo-info-see-more'),el('span','See Less ↑','photo-info-see-less'));
  const expanded=el('div',undefined,'photo-info-extended');
  if(longAbout)expanded.append(el('p',about,'photo-info-full'));
  addExtras(expanded);
  expandable.append(summary,expanded);
  expandable.addEventListener('toggle',()=>frame.classList.toggle('is-expanded',expandable.open));
  info.append(expandable);
 }else addExtras(info);
 frame.append(shade,info);
 return frame;
}

async function detail(){
 $('retry').hidden=true;$('detail').hidden=true;
 const id=new URL(location.href).searchParams.get('id');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')){$('status').textContent='Invalid profile link. Browse companions to choose a profile.';return;}
 try{
  const [{data:r,error},{data:rating}]=await Promise.all([
   publicClient.from('companion_listings').select(fields).eq('published',true).eq('moderation_status','active').eq('public_id',id).maybeSingle(),
   publicClient.from('companion_rating_public').select('review_count,average_rating').eq('public_id',id).maybeSingle()
  ]);
  if(error)throw error;if(!r){$('status').textContent='This profile is unavailable or has been hidden by its owner.';return;}
  if(bookingView){
   const access=await bookingAccess(r);
   $('detail').replaceChildren(bookingForm(r,access));$('detail').hidden=false;$('status').textContent='';document.title='Booking Details — Sathivo';
   return;
  }
  r.review_count=rating?.review_count||0;r.average_rating=rating?.average_rating||null;
  const [current]=await withCompletedCounts([r]);r.completed_count=current?.completed_count??null;r.is_active_member=current?.is_active_member===true;
  const access=await bookingAccess(r);
  const own=access==='own';
  const copy=el('div',undefined,'detail-copy');copy.append(el('p','GOOD COMPANY, ON YOUR TERMS','eyebrow'));
  const titleRow=el('div',undefined,'detail-title-row'),favorite=favoriteButton(r,true);
  if(own){favorite.disabled=true;favorite.title='Your own profile';favorite.setAttribute('aria-label','Your own profile');}
  titleRow.append(namedHeading('h1',r),favorite);copy.append(titleRow);
  if(own)copy.append(el('span','Your own profile','own-profile-badge'));
  const experience=experienceAndRating(r);if(experience)copy.append(experience);
  // Keep the lightweight share action below the name; safety controls live
  // together under Trust & account details so the profile header stays clean.
  const shareRow=el('div',undefined,'profile-actions sathivo-profile-share-row'),share=el('button',own?'Share My Profile ↗':'Share Profile ↗','sathivo-profile-share-button');
  share.type='button';share.onclick=()=>void shareProfile(r,share);shareRow.append(share);if(own){const edit=el('a','Edit Profile ↗','text-link');edit.href='profile.html';shareRow.append(edit);}copy.append(shareRow);
  const safetyControls=el('section',undefined,'sathivo-profile-safety-tools');
  safetyControls.setAttribute('aria-label','Safety and help actions');
  const safetyHeading=el('h3','Safety & Help','sathivo-profile-safety-heading');
  const safetyActions=el('div',undefined,'sathivo-profile-safety-actions');
  const safetyLink=el('a','🛡️ Safety & Help ↗','sathivo-help-link');safetyLink.href='safety.html#first-meeting';safetyActions.append(safetyLink);
  const reportBtn=el('button','⚑ Report Profile','button button-outline'),blockBtn=el('button','Block User','button button-outline');
  const safetyFeedback=el('p',undefined,'sathivo-safety-feedback');safetyFeedback.setAttribute('role','status');
  reportBtn.type=blockBtn.type='button';
  async function targetForSafety(){
   if(!currentUser){location.href='account.html#login';return null;}
   const {data,error}=await client.from('companion_listings').select('user_id').eq('published',true).eq('moderation_status','active').eq('public_id',r.public_id).maybeSingle();
   if(error||!data?.user_id){safetyFeedback.textContent='This profile is unavailable for reporting. Contact Support if needed.';return null;}
   if(data.user_id===currentUser.id){safetyFeedback.textContent='You cannot report or block your own profile.';return null;}
   return data.user_id;
  }
  reportBtn.onclick=async()=>{safetyFeedback.textContent='';reportBtn.disabled=true;try{
   const target=await targetForSafety();
   if(target){const submitted=await openSafetyReport({client,reporterId:currentUser.id,reportedUserId:target});
    if(submitted)safetyFeedback.textContent='Report submitted privately to Sathivo for review.';}
   }catch{ safetyFeedback.textContent='Could not open report. Please try again.';}finally{reportBtn.disabled=false;}};
  blockBtn.onclick=async()=>{safetyFeedback.textContent='';blockBtn.disabled=true;try{
   const target=await targetForSafety();
   if(target&&await confirmSafetyBlock()){
    const {error}=await client.from('user_blocks').insert({blocker_id:currentUser.id,blocked_id:target});
    if(error&&error.code!=='23505')throw error;
    blockBtn.textContent='User blocked';blockBtn.disabled=true;
    safetyFeedback.textContent='This user is blocked. Any existing booking is not automatically cancelled.';
    return;
   }
   }catch{ safetyFeedback.textContent='Could not block this user. Please try again.';}finally{if(blockBtn.textContent!=='User blocked')blockBtn.disabled=false;}};
  if(!own)safetyActions.append(reportBtn,blockBtn);
  safetyControls.append(safetyHeading,safetyActions,safetyFeedback);
  copy.append(el('p',locationName(r.location_id,r.city_name)),el('div',rateText(r.hourly_rate),'detail-rate'),trustChips(r),tags(r));
  // The profile contains only the booking entry point; the form lives in the dedicated booking view.
  copy.append(profileBookingAction(r,access));
  const trust=el('section',undefined,'profile-trust-panel');trust.append(el('strong','Trust & account details'));const trustGrid=el('div',undefined,'profile-trust-grid');
  trustGrid.append(el('span',r.email_verified_at?'✓ Email verified':'Email verification unavailable'),el('span',r.adult_confirmed?'18+ self-declared':'Age declaration missing'),el('span',r.boundaries_accepted?'Platonic boundaries accepted':'Boundaries declaration missing'));
  if(r.joined_at)trustGrid.append(el('span','Member since '+new Intl.DateTimeFormat('en-IN',{month:'short',year:'numeric'}).format(new Date(r.joined_at))));if(r.safety_id)trustGrid.append(el('span','Safety ID '+r.safety_id));trust.append(trustGrid);copy.append(trust,safetyControls);
  // About, languages, interests and availability appear on the photo overlay
  // (with full text available through See More), instead of repeating below the form.
  const reviews=el('section',undefined,'public-reviews');reviews.id='ratings-and-reviews';reviews.tabIndex=-1;
  reviews.append(el('h2','Ratings & Reviews'),el('p',ratingText(r),'public-reviews-summary'));
  const reviewList=el('div',undefined,'public-review-list');reviews.append(reviewList);
  try{
   const {data,error:reviewError}=await publicClient.rpc('public_companion_review_comments',{p_public_id:r.public_id,p_limit:15});
   if(reviewError)throw reviewError;
   if(!data?.length)reviewList.append(el('p','No written reviews yet. Reviews are from completed bookings and appear with permission.','public-review-empty'));
   else for(const item of data){
    const review=el('article',undefined,'public-review');
    review.append(el('strong','★ '+Number(item.rating)+' / 5'));
    const time=new Date(item.created_at);
    if(!Number.isNaN(time.getTime()))review.append(el('time',new Intl.DateTimeFormat('en-IN',{month:'short',year:'numeric'}).format(time)));
    review.append(el('p',item.comment));reviewList.append(review);
   }
  }catch{reviewList.append(el('p','Written reviews are unavailable right now. Please try later.'));}
  copy.append(reviews);
  const safetyNote=el('section',undefined,'sathivo-safety-panel');
  safetyNote.append(el('h3','🛡️ First meeting? Stay in control.'),el('p','Choose a public place, tell someone you trust, arrange your own travel and never share passwords or UPI PINs.'));
  const moreSafety=el('a','Read our Safety & Community Guidelines ↗');moreSafety.href='safety.html#first-meeting';safetyNote.append(moreSafety);copy.append(safetyNote);
  copy.append(el('p','The displayed amount is the companion’s own hourly rate. You can propose a different hourly amount in your request. A price becomes agreed only if the companion accepts your request. Payment happens directly between users outside Sathivo; Sathivo does not process payments.','payment-note'),el('p','Self-described profile. Identity and age have not been verified. Availability is a preference, not a confirmed booking.','launch-note'),el('p','18+ and strictly platonic. Respect boundaries and choose public places for in-person meetings.'));
  $('detail').replaceChildren(detailPhotoFrame(r),copy);$('detail').hidden=false;$('status').textContent='';document.title=r.display_name+' — Sathivo';
  if(location.hash==='#ratings-and-reviews')requestAnimationFrame(()=>reviews.scrollIntoView({behavior:'smooth',block:'start'}));
 }catch(e){$('status').textContent=e.message||'Could not load this profile. Please try again.';$('retry').hidden=false;}
}
// State/district options are bundled locally, so they remain usable even when
// Auth refreshes or the network is slow. Avoid registering handlers twice on retry.
function setupDirectory(){
 if(!directory||filtersReady)return;
 filtersReady=true;
 const disclosure=$('directory-filters');
 if(disclosure&&window.matchMedia('(max-width: 640px)').matches)disclosure.open=false;
 opts('state',statesAndUTs.map(v=>[v,v]),'All India — all states / UTs');
 districts();
 for(const group of experienceCategoryGroups){
  const options=document.createElement('optgroup');options.label=group.title;
  group.items.forEach(value=>options.append(new Option(experienceLabel(value),value)));
  $('category').append(options);
 }
 const requestedCategory=new URLSearchParams(location.search).get('category');
 if(!savedView&&requestedCategory&&experienceCategoryGroups.some(group=>group.items.includes(requestedCategory)))$('category').value=requestedCategory;
 $('filters').onsubmit=e=>{e.preventDefault();page=0;const mobile=window.matchMedia('(max-width: 640px)').matches;if(mobile&&disclosure)disclosure.open=false;void list({fromPagination:mobile});};
 $('filters').onchange=e=>{
  if(e.target.id==='state')districts();
  else if(e.target.id==='district'){$('city').value='';$('city-custom').value='';$('city-custom').hidden=true;void refreshCitySuggestions();}
  else if(e.target.id==='city')syncCitySearch();
  if(['state','district','city','gender-filter'].includes(e.target.id)){page=0;void list();}
 };
 $('city-custom').addEventListener('change',()=>{page=0;void list();});
 $('filters').onreset=e=>{e.preventDefault();$('state').value='';districts();$('city-custom').value='';$('category').value=$('mode').value=$('gender-filter').value='';$('sort').value='discover';$('saved-only').checked=false;page=0;void list();};
 $('saved-only').addEventListener('change',()=>{if($('saved-only').checked&&!currentUser){$('saved-only').checked=false;location.href='account.html#login';return}page=0;void list();});
 $('sort').addEventListener('change',()=>{page=0;void list();});
 $('previous').onclick=()=>{if(page>0&&!$('previous').disabled){page--;void list({fromPagination:true});}};
 $('next').onclick=()=>{if(!$('next').disabled){page++;void list({fromPagination:true});}};
}
function refreshAccountInBackground(){
 if(authStarted)return;
 authStarted=true;
 // Keep public details readable while account ownership is checked.
 // Never enable a booking form before the viewer's own-listing lookup succeeds.
 void (async()=>{
  try{
   const {data,error}=await client.auth.getUser();
   currentUser=error?null:(data?.user||null);
   if(currentUser){
    await loadFavorites();
    document.querySelectorAll('[data-favorite-id]').forEach(button=>syncFavoriteButtons(button.dataset.favoriteId));
   }
  }catch{/* Public content remains readable without a restored account. */}
  finally{
   detailAuthReady=true;
   if(!directory&&$('detail')&&!$('detail').hidden&&!$('detail').querySelector('.booking-form form'))void detail();
  }
 })();
}
async function loadPublicLocations(){
 const {data,error}=await publicClient.from('profile_locations').select('id,state,district,city').order('state');
 if(error)throw error;
 locations=data||[];
 locationsLoaded=true;
}
async function init(){
 try{
  setupDirectory();
  // Public data uses its own isolated anonymous client, never the user's
  // potentially expired browser session.
  publicClient=await getSathivoPublicClient();
  // Public listings must not wait for a possibly expired account session.
  // The public client uses its own anonymous, non-persistent auth state.
  try{await loadPublicLocations();}
  catch(error){
   locationsLoaded=false;
   console.warn('Sathivo location index temporarily unavailable:',error?.code||error?.message||'network error');
  }
  if(bookingView){
   // Check the current account before enabling any booking controls.
   client=await getSathivoClient();
   const auth=await client.auth.getUser();
   currentUser=auth.error?null:auth.data?.user||null;
   detailAuthReady=true;authStarted=true;
   await detail();return;
  }
  if(savedView){
   // Saved profiles are private account data. Authenticate before applying
   // the existing saved-only filter; ordinary Explore remains public-first.
   client=await getSathivoClient();
   const auth=await client.auth.getUser();
   if(auth.error)throw Error('Could not restore your account. Please sign in and retry.');
   currentUser=auth.data?.user||null;
   if(!currentUser){location.href='account.html#login';return;}
   await loadFavorites({strict:true});
   authStarted=true;
   $('saved-only').checked=true;
   await list();
  }else if(directory)await list();
  else await detail();
  // Restore optional logged-in features only after public content is visible.
  try{
   client=await getSathivoClient();
   refreshAccountInBackground();
  }catch(error){
   detailAuthReady=true;
   if(!directory&&$('detail')&&!$('detail').hidden)void detail();
   console.warn('Optional account tools unavailable, public discovery remains available:',error?.message||'network error');
  }
 }catch(error){
  $('status').textContent='Could not connect to Sathivo right now. Please try again.';
  $('retry').hidden=false;
  console.warn('Sathivo discovery initialization failed:',error?.message||'network error');
 }
}
// The Account preview imports this exact Explore renderer on demand.
// Never start directory/detail initialization on an Account page.
export async function loadOwnPublicPreview(accountClient,expectedUserId){
 const identity=await accountClient.auth.getUser();
 const owner=identity.data?.user;
 if(identity.error||!owner?.email_confirmed_at||owner.id!==expectedUserId)
  throw Error('Sign in again to preview your profile.');
 // Use the authenticated client only to identify the owner's listing.
 // Never render the private member profile or unpublished listing fields.
 const {data:listing,error}=await accountClient.from('companion_listings')
  .select('public_id,published,moderation_status').eq('user_id',owner.id).maybeSingle();
 if(error)throw error;
 if(!listing)return {state:'unpublished'};
 if(!listing.published)return {state:'hidden'};
 if(listing.moderation_status!=='active')return {state:'unavailable'};
 publicClient=await getSathivoPublicClient();
 // Match Explore's RPC, filters and optional public badges exactly.
 const response=await publicClient.rpc('browse_public_companions_v3',{
  p_location_ids:null,p_city:null,p_gender:null,p_category:null,p_mode:null,
  p_sort:'newest',p_public_ids:[listing.public_id],p_offset:0,p_limit:1
 });
 if(response.error)throw response.error;
 const visible=(response.data||[]).find(row=>row.public_id===listing.public_id);
 if(!visible)return {state:'unavailable'};
 try{if(!locationsLoaded)await loadPublicLocations();}catch{}
 const [row]=await withCompletedCounts([visible]);
 // Same card, same renderer and stylesheet; saving your own card is disabled.
 const node=card(row);
 const favorite=node.querySelector('.favorite-button');
 if(favorite){favorite.disabled=true;favorite.title='Your own profile';favorite.setAttribute('aria-label','Your own profile');}
 return {state:'public',row,node,url:publicProfileUrl(row)};
}
if(directory||$('detail')){
 $('retry').onclick=()=>void init();
 void init();
}
