import {authConfig} from './auth-config.js?v=20260926-1';
const $=id=>document.getElementById(id), directory=!!$('filters');
const fields='public_id,display_name,bio,location_id,languages,interests,categories,meeting_mode,availability,photo_path';
let client,locations=[],page=0,request=0,currentUser=null;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function opts(id,rows,title){$(id).replaceChildren(new Option(title,''));rows.forEach(([v,t])=>$(id).add(new Option(t,String(v))));}
function matching(){return locations.filter(r=>(!$('state').value||r.state===$('state').value)&&(!$('district').value||r.district===$('district').value));}
function cities(){opts('city',matching().map(r=>[r.id,r.city+' · '+r.state]),'All cities / towns');}
function districts(){opts('district',[...new Set(locations.filter(r=>!$('state').value||r.state===$('state').value).map(r=>r.district))].sort().map(v=>[v,v]),'All districts');cities();}
function locationName(id){const r=locations.find(r=>r.id===id);return r?[r.city,r.district,r.state].join(' · '):'Location unavailable';}
function tags(row){const n=el('div',undefined,'tags');[{'online':'Online','in-person':'In person','both':'Online & in person'}[row.meeting_mode],...row.categories].forEach(v=>n.append(el('span',v)));return n;}
function portrait(row){const initial=row.display_name.slice(0,1).toUpperCase(),n=el('div',initial,'portrait');if(row.photo_path)void client.storage.from('listing-photos').createSignedUrl(row.photo_path,60).then(({data,error})=>{if(error||!data)return;const img=el('img');img.alt=row.display_name+' — profile photo';img.loading='lazy';img.src=data.signedUrl;img.onerror=()=>n.replaceChildren(document.createTextNode(initial));n.replaceChildren(img);});return n;}
function card(row){const n=el('article',undefined,'companion-card'),copy=el('div',undefined,'card-copy');copy.append(el('h2',row.display_name),el('p',locationName(row.location_id)),tags(row),el('p',row.bio.length>150?row.bio.slice(0,147)+'…':row.bio));const link=el('a','Get to know '+row.display_name+' ↗','text-link');link.href='companion.html?id='+encodeURIComponent(row.public_id);copy.append(link);n.append(portrait(row),copy);return n;}
async function list(){
 const seq=++request;$('results').replaceChildren();$('empty').hidden=true;$('retry').hidden=true;$('previous').disabled=$('next').disabled=true;$('status').textContent='Finding good company…';
 let q=client.from('companion_listings').select(fields).eq('published',true).eq('moderation_status','active').order('public_id').range(page*24,page*24+24);
 if($('city').value)q=q.eq('location_id',Number($('city').value));else if($('state').value||$('district').value)q=q.in('location_id',matching().map(r=>r.id));
 if($('category').value)q=q.contains('categories',[$('category').value]);
 if($('mode').value)q=q.in('meeting_mode',[$('mode').value,'both']);
 try{const {data,error}=await q;if(seq!==request)return;if(error)throw error;const rows=data.slice(0,24);$('results').replaceChildren(...rows.map(card));$('empty').hidden=rows.length>0;$('status').textContent=rows.length?rows.length+' companions on this page.':'No matching companions yet.';$('previous').disabled=page===0;$('next').disabled=data.length<=24;$('page-label').textContent='Page '+(page+1);}catch{if(seq!==request)return;$('status').textContent='Could not load companions. Please try again.';$('retry').hidden=false;}
}
function bookingForm(r){
 const wrap=el('section',undefined,'booking-form');
 wrap.append(el('h2','Send a booking request'),el('p','Choose the plan that works for you. Your companion can accept or decline the request.'));
 if(!currentUser){const a=el('a','Sign in to send a request ↗','button button-primary');a.href='account.html#login';wrap.append(a);return wrap;}
 const form=document.createElement('form'),grid=el('div',undefined,'booking-grid');
 const category=document.createElement('select');category.required=true;r.categories.forEach(v=>category.add(new Option(v,v)));
 const mode=document.createElement('select');mode.required=true;if(['online','both'].includes(r.meeting_mode))mode.add(new Option('Online','online'));if(['in-person','both'].includes(r.meeting_mode))mode.add(new Option('In person — public place','in-person'));
 const when=document.createElement('input');when.type='datetime-local';when.required=true;const minDate=new Date(Date.now()+30*60*1000);const pad=n=>String(n).padStart(2,'0');when.min=`${minDate.getFullYear()}-${pad(minDate.getMonth()+1)}-${pad(minDate.getDate())}T${pad(minDate.getHours())}:${pad(minDate.getMinutes())}`;
 const duration=document.createElement('select');[30,60,90,120,180].forEach(v=>duration.add(new Option(v+' minutes',String(v))));duration.value='60';
 const note=document.createElement('textarea');note.maxLength=1000;note.rows=3;note.placeholder='Example: Coffee and a relaxed conversation around 5 PM.';
 const field=(label,input,full=false,helper='')=>{const box=el('div',undefined,'booking-field'+(full?' full':'')),lab=el('label',label);lab.append(input);box.append(lab);if(helper)box.append(el('small',helper,'booking-helper'));return box;};
 grid.append(
   field('Experience',category),
   field('Meeting type',mode),
   field('Preferred date & time',when,false,'Choose a future time that suits you.'),
   field('Duration',duration),
   field('Note to companion',note,true,'Optional. Do not share phone numbers, payment details or your exact home address.')
 );
 form.append(grid);
 const row=el('div',undefined,'booking-submit-row'),b=el('button','Send request ↗','button button-primary'),status=el('p','', 'field-hint');b.type='submit';row.append(b,status);form.append(row);
 form.onsubmit=async e=>{e.preventDefault();const chosen=new Date(when.value);if(!when.value||Number.isNaN(chosen.getTime())||chosen<=new Date()){status.textContent='Please choose a future date and time.';when.focus();return}b.disabled=true;status.textContent='Sending request…';try{const iso=chosen.toISOString();const {data,error}=await client.rpc('create_booking_request',{p_companion_public_id:r.public_id,p_category:category.value,p_meeting_mode:mode.value,p_requested_for:iso,p_duration_minutes:Number(duration.value),p_note:note.value.trim()});if(error)throw error;status.textContent='Request sent. Opening your bookings…';location.href='bookings.html?id='+encodeURIComponent(data)}catch(err){status.textContent=err.message||'Could not send request.';b.disabled=false;}};
 wrap.append(form);return wrap;
}
async function detail(){
 $('retry').hidden=true;$('detail').hidden=true;
 const id=new URL(location.href).searchParams.get('id');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')){$('status').textContent='Invalid profile link. Browse companions to choose a profile.';return;}
 try{const {data:r,error}=await client.from('companion_listings').select(fields).eq('published',true).eq('moderation_status','active').eq('public_id',id).maybeSingle();if(error)throw error;if(!r){$('status').textContent='This profile is unavailable or has been hidden by its owner.';return;}
 const copy=el('div',undefined,'detail-copy');copy.append(el('p','GOOD COMPANY, ON YOUR TERMS','eyebrow'),el('h1',r.display_name),el('p',locationName(r.location_id)),tags(r));
 for(const [t,v] of [['About me',r.bio],['Languages',r.languages],['Interests & vibe',r.interests],['Usual availability',r.availability]])if(v)copy.append(el('h2',t),el('p',v));
 const rating=await client.from('companion_rating_public').select('review_count,average_rating').eq('public_id',r.public_id).maybeSingle();if(!rating.error&&rating.data?.review_count>0){const x=rating.data;copy.append(el('h2','Completed-booking rating'),el('p',x.average_rating+' / 5 · '+x.review_count+' review'+(Number(x.review_count)===1?'':'s')));}
 copy.append(el('p','Self-described profile. Identity and age have not been verified. Availability is a preference, not a confirmed booking.','launch-note'),el('p','18+ and strictly platonic. Respect boundaries and choose public places for in-person meetings.'),bookingForm(r));
 $('detail').replaceChildren(portrait(r),copy);$('detail').hidden=false;$('status').textContent='';document.title=r.display_name+' — Sathivo';
 }catch(e){$('status').textContent=e.message||'Could not load this profile. Please try again.';$('retry').hidden=false;}
}
async function init(){try{
 if(!globalThis.supabase)throw Error();
 client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
 const [loc,u]=await Promise.all([client.from('profile_locations').select('*').order('state'),client.auth.getUser()]);if(loc.error)throw loc.error;locations=loc.data;currentUser=u.data?.user||null;
 if(directory){opts('state',[...new Set(locations.map(r=>r.state))].sort().map(v=>[v,v]),'All states / UTs');districts();
 ['Conversation','Coffee','Movies','Shopping','Events','Walking','Online chat','Phone conversation'].forEach(v=>$('category').add(new Option(v,v)));
 $('filters').onsubmit=e=>e.preventDefault();$('filters').onchange=e=>{if(e.target.id==='state')districts();else if(e.target.id==='district')cities();page=0;void list();};
 $('filters').onreset=e=>{e.preventDefault();$('state').value='';districts();$('category').value=$('mode').value='';page=0;void list();};
 $('previous').onclick=()=>{if(page>0){page--;void list();}};$('next').onclick=()=>{page++;void list();};await list();
 }else await detail();
 }catch{$('status').textContent='Discovery could not load. Please refresh the page.';}
}
$('retry').onclick=()=>void(directory?list():detail());void init();
