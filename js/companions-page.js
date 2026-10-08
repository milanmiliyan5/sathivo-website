import {getSathivoClient} from './supabase-client.js?v=20261006-1';
import {sendBookingPush} from './push-events.js?v=20261004-1';
import {avatarAsset} from './avatar-utils.js?v=20261007-1';

const $=id=>document.getElementById(id),directory=!!$('filters');
const fields='public_id,display_name,bio,location_id,city_name,languages,interests,categories,meeting_mode,availability,hourly_rate,photo_path,safety_id,joined_at,email_verified_at,adult_confirmed,boundaries_accepted';
let client,locations=[],page=0,request=0,currentUser=null,favoriteIds=new Set(),citySuggestionRequest=0;

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
async function refreshCitySuggestions(preferred=''){
 const seq=++citySuggestionRequest,select=$('city');if(!select)return;
 const names=new Set(matching().filter(r=>r.city!=='District-wide').map(r=>r.city).filter(Boolean));
 try{
  const ids=selectedLocationIds();
  const {data,error}=await client.rpc('browse_public_city_suggestions',{p_location_ids:ids?.length?ids:null});
  if(!error)(data||[]).forEach(row=>{if(row.city_name)names.add(row.city_name);});
 }catch{}
 if(seq!==citySuggestionRequest)return;
 const sorted=[...names].sort((a,b)=>a.localeCompare(b,'en-IN'));
 opts('city',sorted.map(name=>[name,name]),'All cities / towns');
 $('city').add(new Option('Other city / town — type manually','__other__'));
 const exact=sorted.find(name=>normalized(name)===normalized(preferred));
 if(preferred){
  if(exact){$('city').value=exact;$('city-custom').value='';}
  else{$('city').value='__other__';$('city-custom').value=preferred;}
 }
 syncCitySearch();
}
function districts(){
 opts('district',[...new Set(locations.filter(r=>!$('state').value||r.state===$('state').value).map(r=>r.district))].sort().map(v=>[v,v]),'All districts');
 $('city-custom').value='';void refreshCitySuggestions();
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
function tags(row){const n=el('div',undefined,'tags');[{'online':'Online','in-person':'In person','both':'Online & in person'}[row.meeting_mode],...row.categories].forEach(v=>n.append(el('span',v)));return n;}
function portrait(row){
 const initial=row.display_name.slice(0,1).toUpperCase(),n=el('div',initial,'portrait');
 if(!row.photo_path)return n;
 const builtIn=avatarAsset(row.photo_path);
 if(builtIn){const img=el('img');img.alt=row.display_name+' — profile avatar';img.loading='lazy';img.src=builtIn;n.classList.add('is-builtin-avatar');n.replaceChildren(img);return n;}
 void client.storage.from('listing-photos').createSignedUrl(row.photo_path,60).then(({data,error})=>{if(error||!data)return;const img=el('img');img.alt=row.display_name+' — profile photo';img.loading='lazy';img.src=data.signedUrl;img.onerror=()=>n.replaceChildren(document.createTextNode(initial));n.replaceChildren(img);});
 return n;
}
function trustChips(row,compact=false){const n=el('div',undefined,'trust-chips'+(compact?' compact':''));if(row.email_verified_at)n.append(el('span','✓ Email verified'));if(row.adult_confirmed)n.append(el('span','18+ self-declared'));if(row.boundaries_accepted)n.append(el('span','Platonic boundaries'));return n;}
function rateText(rate){return Number(rate)>0?'₹'+Number(rate).toLocaleString('en-IN')+' / hour':'Rate not set'}
function totalFor(rate,minutes){return Number(rate)>0?Math.round(Number(rate)*Number(minutes)/60):null}
function ratingText(row){const n=Number(row.review_count||0);return n>0?'★ '+Number(row.average_rating||0).toFixed(1)+' · '+n+' review'+(n===1?'':'s'):'New companion';}
async function loadFavorites(){
 favoriteIds=new Set();
 if(!currentUser)return;
 const {data,error}=await client.from('companion_favorites').select('companion_public_id').eq('user_id',currentUser.id);
 if(!error)(data||[]).forEach(r=>favoriteIds.add(r.companion_public_id));
}
function syncFavoriteButtons(publicId){
 document.querySelectorAll('[data-favorite-id="'+CSS.escape(publicId)+'"]').forEach(button=>{
  const saved=favoriteIds.has(publicId);
  button.classList.toggle('saved',saved);
  button.setAttribute('aria-pressed',String(saved));
  button.title=saved?'Remove from saved':'Save companion';
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
 b.onclick=()=>void toggleFavorite(row.public_id);
 return b;
}
async function shareProfile(row,button){
 const url=new URL('companion.html?id='+encodeURIComponent(row.public_id),location.href).href;
 const data={title:row.display_name+' on Sathivo',text:'See '+row.display_name+' on Sathivo — strictly platonic companionship.',url};
 try{
  if(navigator.share){await navigator.share(data);return}
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);const old=button.textContent;button.textContent='Link copied ✓';setTimeout(()=>button.textContent=old,1600);return}
  prompt('Copy this Sathivo profile link:',url);
 }catch(error){if(error?.name!=='AbortError')prompt('Copy this Sathivo profile link:',url);}
}
function card(row){
 const n=el('article',undefined,'companion-card'),copy=el('div',undefined,'card-copy'),head=el('div',undefined,'card-heading-row'),name=el('h2',row.display_name);
 head.append(name,favoriteButton(row));
 copy.append(head,el('p',locationName(row.location_id,row.city_name)),el('strong',rateText(row.hourly_rate),'rate-chip'),el('span',ratingText(row),'rating-line'),trustChips(row,true),tags(row),el('p',row.bio.length>150?row.bio.slice(0,147)+'…':row.bio));
 const actions=el('div',undefined,'card-actions'),link=el('a','Get to know '+row.display_name+' ↗','text-link'),share=el('button','Share ↗','text-link share-link');
 link.href='companion.html?id='+encodeURIComponent(row.public_id);share.type='button';share.onclick=()=>void shareProfile(row,share);actions.append(link,share);copy.append(actions);n.append(portrait(row),copy);return n;
}
function feedNodes(rows){
 const nodes=[];
 rows.forEach((row,index)=>{nodes.push(card(row));if((index===5||index===13)&&index<rows.length-1){const ad=el('div',undefined,'ad-slot ad-slot-inline');ad.dataset.adSlot='directory-inline';ad.hidden=true;nodes.push(ad);}});
 return nodes;
}
function sortLabel(){return {newest:'Newest',price_asc:'Price: low to high',price_desc:'Price: high to low',rating:'Top rated'}[$('sort')?.value]||'Newest';}
async function list(){
 const seq=++request;$('empty').hidden=true;$('retry').hidden=true;$('previous').disabled=$('next').disabled=true;$('status').textContent='Finding good company…';
 $('results').replaceChildren(...Array.from({length:6},()=>{const n=el('article',undefined,'companion-card companion-skeleton');n.innerHTML='<div class="portrait skeleton-block"></div><div class="card-copy"><i></i><i></i><i></i><i></i></div>';return n}));
 const savedOnly=$('saved-only').checked;
 if(savedOnly&&!currentUser){location.href='account.html#login';return}
 const savedIds=savedOnly?[...favoriteIds]:null;
 if(savedOnly&&!savedIds.length){$('results').replaceChildren();$('empty').hidden=false;$('status').textContent='No saved companions yet.';$('previous').disabled=$('next').disabled=true;$('page-label').textContent='';return}
 const locationIds=selectedLocationIds();
 try{
  const {data,error}=await client.rpc('browse_public_companions_v2',{
   p_location_ids:locationIds?.length?locationIds:null,
   p_city:selectedCity()||null,
   p_category:$('category').value||null,
   p_mode:$('mode').value||null,
   p_sort:$('sort').value||'newest',
   p_public_ids:savedIds,
   p_offset:page*24,
   p_limit:25
  });
  if(seq!==request)return;if(error)throw error;
  const all=data||[],rows=all.slice(0,24);$('results').replaceChildren(...feedNodes(rows));$('empty').hidden=rows.length>0;
  $('status').textContent=rows.length?'Showing '+rows.length+' published companion'+(rows.length===1?'':'s')+' · '+scopeName()+' · '+sortLabel()+'.':'No published companions match these filters yet.';
  $('previous').disabled=page===0;$('next').disabled=all.length<=24;$('page-label').textContent=rows.length?'Page '+(page+1):'';
 }catch(error){if(seq!==request)return;$('results').replaceChildren();$('status').textContent='Could not load companions. Please try again.';$('retry').hidden=false;}
}
function bookingForm(r){
 const wrap=el('section',undefined,'booking-form');
 wrap.append(el('h2','Send a booking request'),el('p','The companion has set '+rateText(r.hourly_rate)+'. You can send your own hourly offer. If they accept, your offer becomes the agreed rate.'));
 if(!Number(r.hourly_rate)){wrap.append(el('p','This companion has not set a rate yet, so new booking requests are temporarily unavailable.','payment-note'));return wrap;}
 if(!currentUser){const a=el('a','Sign in to send a request ↗','button button-primary');a.href='account.html#login';wrap.append(a);return wrap;}
 const form=document.createElement('form'),grid=el('div',undefined,'booking-grid');
 const category=document.createElement('select');category.required=true;r.categories.forEach(v=>category.add(new Option(v,v)));
 const mode=document.createElement('select');mode.required=true;if(['online','both'].includes(r.meeting_mode))mode.add(new Option('Online','online'));if(['in-person','both'].includes(r.meeting_mode))mode.add(new Option('In person — public place','in-person'));
 const when=document.createElement('input');when.type='datetime-local';when.required=true;const minDate=new Date(Date.now()+30*60*1000);const pad=n=>String(n).padStart(2,'0');when.min=`${minDate.getFullYear()}-${pad(minDate.getMonth()+1)}-${pad(minDate.getDate())}T${pad(minDate.getHours())}:${pad(minDate.getMinutes())}`;
 const duration=document.createElement('select');[30,60,90,120,180].forEach(v=>duration.add(new Option(v+' minutes',String(v))));duration.value='60';
 const offer=document.createElement('input');offer.type='number';offer.min='1';offer.max='100000';offer.step='1';offer.inputMode='numeric';offer.required=true;offer.value=String(r.hourly_rate);offer.placeholder='Your offer per hour';
 const estimate=el('small','', 'booking-helper deal-estimate');
 const updateEstimate=()=>{const rate=Number(offer.value),mins=Number(duration.value),total=totalFor(rate,mins);estimate.textContent=total?'Your offer: '+rateText(rate)+' · Approx. ₹'+total.toLocaleString('en-IN')+' for '+mins+' minutes.':'Enter a valid hourly offer.';};offer.addEventListener('input',updateEstimate);duration.addEventListener('change',updateEstimate);updateEstimate();
 const note=document.createElement('textarea');note.maxLength=1000;note.rows=3;note.placeholder='Example: Coffee and a relaxed conversation around 5 PM.';
 const field=(label,input,full=false,helper='')=>{const box=el('div',undefined,'booking-field'+(full?' full':'')),lab=el('label',label);lab.append(input);box.append(lab);if(helper)box.append(el('small',helper,'booking-helper'));return box;};
 grid.append(field('Experience',category),field('Meeting type',mode),field('Preferred date & time',when,false,'Choose a future time that suits you.'),field('Duration',duration),field('Your hourly offer (₹)',offer,false,'You may offer the listed rate or a different amount. The companion decides whether to accept.'),field('Offer estimate',estimate,false),field('Note to companion',note,true,'Optional. Use this for the plan or preferred public meeting area. Do not share passwords, OTPs or your exact home address.'));
 form.append(grid);form.append(el('p','Payment is outside Sathivo. After you both agree, you may settle directly between yourselves by cash, UPI/PhonePe/Google Pay or another lawful method you both choose. Sathivo does not collect, hold, refund or guarantee that payment. Never share a UPI PIN or OTP.','payment-note'));
 const row=el('div',undefined,'booking-submit-row'),b=el('button','Send request ↗','button button-primary'),status=el('p','', 'field-hint');b.type='submit';row.append(b,status);form.append(row);
 form.onsubmit=async e=>{e.preventDefault();const chosen=new Date(when.value);if(!when.value||Number.isNaN(chosen.getTime())||chosen<=new Date()){status.textContent='Please choose a future date and time.';when.focus();return}b.disabled=true;status.textContent='Sending request…';try{const iso=chosen.toISOString();const offerRate=Number(offer.value);if(!Number.isInteger(offerRate)||offerRate<1||offerRate>100000){status.textContent='Enter a valid hourly offer between ₹1 and ₹1,00,000.';offer.focus();b.disabled=false;return}const {data,error}=await client.rpc('create_booking_request_with_offer',{p_companion_public_id:r.public_id,p_category:category.value,p_meeting_mode:mode.value,p_requested_for:iso,p_duration_minutes:Number(duration.value),p_note:note.value.trim(),p_offer_hourly_rate:offerRate});if(error)throw error;status.textContent='Request sent. Notifying the companion…';await sendBookingPush(client,data,'request');status.textContent='Request sent. Opening your bookings…';location.href='bookings.html?id='+encodeURIComponent(data)+'&booked=1'}catch(err){status.textContent=err.message||'Could not send request.';b.disabled=false;}};
 wrap.append(form);return wrap;
}
async function detail(){
 $('retry').hidden=true;$('detail').hidden=true;
 const id=new URL(location.href).searchParams.get('id');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')){$('status').textContent='Invalid profile link. Browse companions to choose a profile.';return;}
 try{
  const [{data:r,error},{data:rating}]=await Promise.all([
   client.from('companion_listings').select(fields).eq('published',true).eq('moderation_status','active').eq('public_id',id).maybeSingle(),
   client.from('companion_rating_public').select('review_count,average_rating').eq('public_id',id).maybeSingle()
  ]);
  if(error)throw error;if(!r){$('status').textContent='This profile is unavailable or has been hidden by its owner.';return;}
  r.review_count=rating?.review_count||0;r.average_rating=rating?.average_rating||null;
  const copy=el('div',undefined,'detail-copy');copy.append(el('p','GOOD COMPANY, ON YOUR TERMS','eyebrow'));
  const titleRow=el('div',undefined,'detail-title-row');titleRow.append(el('h1',r.display_name),favoriteButton(r,true));copy.append(titleRow);
  const profileActions=el('div',undefined,'profile-actions'),share=el('button','Share profile ↗','button button-outline');share.type='button';share.onclick=()=>void shareProfile(r,share);profileActions.append(share);copy.append(profileActions);
  copy.append(el('p',locationName(r.location_id,r.city_name)),el('div',rateText(r.hourly_rate),'detail-rate'),el('p',ratingText(r),'rating-line'),trustChips(r),tags(r));
  const trust=el('section',undefined,'profile-trust-panel');trust.append(el('strong','Trust & account details'));const trustGrid=el('div',undefined,'profile-trust-grid');
  trustGrid.append(el('span',r.email_verified_at?'✓ Email verified':'Email verification unavailable'),el('span',r.adult_confirmed?'18+ self-declared':'Age declaration missing'),el('span',r.boundaries_accepted?'Platonic boundaries accepted':'Boundaries declaration missing'));
  if(r.joined_at)trustGrid.append(el('span','Member since '+new Intl.DateTimeFormat('en-IN',{month:'short',year:'numeric'}).format(new Date(r.joined_at))));if(r.safety_id)trustGrid.append(el('span','Safety ID '+r.safety_id));trust.append(trustGrid);copy.append(trust);
  for(const [t,v] of [['About me',r.bio],['Languages',r.languages],['Interests & vibe',r.interests],['Usual availability',r.availability]])if(v)copy.append(el('h2',t),el('p',v));
  if(Number(r.review_count)>0)copy.append(el('h2','Completed-booking rating'),el('p',Number(r.average_rating).toFixed(1)+' / 5 · '+r.review_count+' review'+(Number(r.review_count)===1?'':'s')));
  copy.append(el('p','The displayed amount is the companion’s own hourly rate. You can propose a different hourly amount in your request. A price becomes agreed only if the companion accepts your request. Payment happens directly between users outside Sathivo; Sathivo does not process payments.','payment-note'),el('p','Self-described profile. Identity and age have not been verified. Availability is a preference, not a confirmed booking.','launch-note'),el('p','18+ and strictly platonic. Respect boundaries and choose public places for in-person meetings.'),bookingForm(r));
  $('detail').replaceChildren(portrait(r),copy);$('detail').hidden=false;$('status').textContent='';document.title=r.display_name+' — Sathivo';
 }catch(e){$('status').textContent=e.message||'Could not load this profile. Please try again.';$('retry').hidden=false;}
}
async function init(){
 try{
  if(!globalThis.supabase)throw Error();
  client=await getSathivoClient();
  const [loc,u]=await Promise.all([client.from('profile_locations').select('*').order('state'),client.auth.getUser()]);if(loc.error)throw loc.error;locations=loc.data;currentUser=u.data?.user||null;await loadFavorites();
  if(directory){
   opts('state',[...new Set(locations.map(r=>r.state))].sort().map(v=>[v,v]),'All India — all states / UTs');districts();
   ['Conversation','Coffee','Movies','Shopping','Events','Walking','Online chat','Phone conversation'].forEach(v=>$('category').add(new Option(v,v)));
   $('filters').onsubmit=e=>{e.preventDefault();page=0;void list();};
   $('filters').onchange=e=>{if(e.target.id==='state')districts();else if(e.target.id==='district'){$('city-custom').value='';void refreshCitySuggestions();}else if(e.target.id==='city')syncCitySearch();};
   $('filters').onreset=e=>{e.preventDefault();$('state').value='';districts();$('city-custom').value='';$('category').value=$('mode').value='';$('sort').value='newest';$('saved-only').checked=false;page=0;void list();};
   $('saved-only').addEventListener('change',()=>{if($('saved-only').checked&&!currentUser){$('saved-only').checked=false;location.href='account.html#login';return}page=0;void list();});
   $('sort').addEventListener('change',()=>{page=0;void list();});
   $('previous').onclick=()=>{if(page>0){page--;void list();}};$('next').onclick=()=>{page++;void list();};await list();
  }else await detail();
 }catch{$('status').textContent='Discovery could not load. Please refresh the page.';}
}
$('retry').onclick=()=>void(directory?list():detail());void init();
