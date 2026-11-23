import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {avatarAsset} from './avatar-utils.js?v=20261121-avatars-1';
import {enableNearbyDevicePush} from './push-settings.js?v=20261123-push-1';

// One pop-up only for real, newly published nearby profiles, never mock entries.
const started=performance.now();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normal=v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
const seenKey=id=>'sathivo.nearby.seen.v1.'+id;
function previouslySeen(userId){
 try{const a=JSON.parse(localStorage.getItem(seenKey(userId))||'[]');return new Set(Array.isArray(a)?a.slice(-300):[])}
 catch{return new Set()}
}
function rememberSeen(userId,ids){
 try{const seen=previouslySeen(userId);ids.forEach(id=>seen.add(id));localStorage.setItem(seenKey(userId),JSON.stringify([...seen].slice(-300)))}
 catch{}
}
function pageElement(tag,cls,text){
 const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;
}
function isModalBusy(){
 return [...document.querySelectorAll('dialog[open], [aria-modal="true"]')].some(x=>x.isConnected);
}
function renderPopup(client,user,prefs,items){
 const modal=pageElement('dialog','nearby-discovery-dialog');
 modal.setAttribute('aria-label','New nearby companions');
 modal.innerHTML='<div class="nearby-discovery-head"><span class="nearby-discovery-pill">📍 NEARBY DISCOVERY</span><button type="button" class="nearby-discovery-close" aria-label="Close popup">×</button></div>'+
 '<h2 class="nearby-discovery-title"></h2><p class="nearby-discovery-desc"></p>'+
 '<div class="nearby-discovery-pages"><article class="nearby-discovery-page" aria-live="polite">'+
 '<div class="nearby-discovery-person"><img class="nearby-discovery-photo" alt="Companion profile photo"><div><h3 class="nearby-discovery-name"></h3><p class="nearby-discovery-city"></p><span class="nearby-discovery-new">Newly joined</span></div></div>'+
 '<div class="nearby-discovery-activities"></div><a class="nearby-discovery-open" href="companions.html">View Profile & Send Request ↗</a></article></div>'+
 '<div class="nearby-discovery-nav"><button type="button" class="nearby-discovery-arrow" data-dir="-1" aria-label="Previous companion">‹</button><span class="nearby-discovery-pagecount"></span><button type="button" class="nearby-discovery-arrow" data-dir="1" aria-label="Next companion">›</button></div>'+
 '<div class="nearby-discovery-footer"><button type="button" class="nearby-discovery-enable">🔔 Enable Chrome nearby alerts</button><span class="nearby-discovery-status" role="status"></span><p class="nearby-discovery-note">18+ · Strictly platonic · No booking confirmed · Swipe to turn pages</p></div>';
 const title=modal.querySelector('.nearby-discovery-title'),desc=modal.querySelector('.nearby-discovery-desc');
 title.textContent=items.length+' New Companion'+(items.length===1?'':'s')+' in Your Area 🎉';
 desc.textContent='New public profiles have joined your area today. Flip through and explore!';
 const sheet=modal.querySelector('.nearby-discovery-pages');
 const photo=modal.querySelector('.nearby-discovery-photo');
 const name=modal.querySelector('.nearby-discovery-name'),city=modal.querySelector('.nearby-discovery-city');
 const chips=modal.querySelector('.nearby-discovery-activities'),open=modal.querySelector('.nearby-discovery-open');
 const count=modal.querySelector('.nearby-discovery-pagecount');
 const enable=modal.querySelector('.nearby-discovery-enable'),feedback=modal.querySelector('.nearby-discovery-status');
 if(prefs?.push_enabled)enable.hidden=true;
 let index=0,flipping=false;
 function paint(){
  const r=items[index],p=r.listing;
  photo.src=r.photo||'assets/favicon.svg';
  photo.alt=(p.display_name||'Sathivo companion')+' profile photo';
  photo.onerror=()=>{photo.onerror=null;photo.src='assets/favicon.svg'};
  name.textContent=p.display_name||'Sathivo Companion';
  city.textContent=[p.city_name,r.district,r.state].filter(Boolean).join(', ');
  chips.replaceChildren();
  (Array.isArray(p.categories)?p.categories.slice(0,4):[]).forEach(c=>chips.append(pageElement('span','nearby-discovery-chip',c)));
  if(!chips.childElementCount)chips.append(pageElement('span','nearby-discovery-chip','Coffee • Conversation • Outings'));
  open.href='companion.html?id='+encodeURIComponent(p.public_id);
  count.textContent=(index+1)+' / '+items.length;
  modal.querySelector('[data-dir="-1"]').disabled=index===0;
  modal.querySelector('[data-dir="1"]').disabled=index===items.length-1;
 }
 function next(direction){
  if(flipping||index+direction<0||index+direction>=items.length)return;
  flipping=true;
  sheet.classList.add('is-flipping');
  setTimeout(()=>{index+=direction;paint()},210);
  setTimeout(()=>{sheet.classList.remove('is-flipping');flipping=false},460);
 }
 modal.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>next(Number(b.dataset.dir))));
 modal.querySelector('.nearby-discovery-close').addEventListener('click',()=>modal.close());
 modal.addEventListener('close',()=>{rememberSeen(user.id,items.map(i=>i.notification_id));modal.remove()});
 modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});
 modal.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();next(-1)}if(e.key==='ArrowRight'){e.preventDefault();next(1)}});
 let pointerX=null;
 sheet.addEventListener('touchstart',e=>{pointerX=e.touches[0]?.clientX??null},{passive:true});
 sheet.addEventListener('touchend',e=>{
  if(pointerX===null)return;
  const delta=(e.changedTouches[0]?.clientX??pointerX)-pointerX;
  pointerX=null;if(Math.abs(delta)>45)next(delta<0?1:-1);
 },{passive:true});
 enable.addEventListener('click',async()=>{
  enable.disabled=true;feedback.textContent='Turning on Chrome alerts…';
  try{
   await enableNearbyDevicePush();
   const {error}=await client.from('nearby_alert_preferences').upsert({
    user_id:user.id,in_app_enabled:true,push_enabled:true,email_enabled:false,updated_at:new Date().toISOString()
   },{onConflict:'user_id'});
   if(error)throw error;
   enable.hidden=true;feedback.textContent='Chrome nearby alerts are now enabled ✓';
  }catch(error){feedback.textContent=error.message||'Please allow notifications in Chrome site settings.'}
  finally{enable.disabled=false}
 });
 paint();document.body.append(modal);
 const link=document.createElement('link');link.rel='stylesheet';link.href='nearby-discovery.css?v=20261123-flip-1';document.head.append(link);
 let tries=0;
 const show=()=>{
  if(!modal.isConnected||document.hidden)return;
  if(isModalBusy()&&tries++<14){setTimeout(show,5000);return}
  if(isModalBusy()){modal.remove();return}
  try{modal.showModal()}catch{modal.remove()}
 };
 setTimeout(show,Math.max(0,20000-(performance.now()-started)));
}
async function init(){
 if(typeof HTMLDialogElement==='undefined'||!window.localStorage)return;
 const client=await getSathivoClient();
 const {data:auth,error:authError}=await client.auth.getUser();
 const user=auth?.user;if(authError||!user)return;
 const {data:profile,error:profileErr}=await client.from('member_profiles')
  .select('location_id,city_name,adult_confirmed,boundaries_accepted').eq('user_id',user.id).maybeSingle();
 if(profileErr||!profile?.location_id||!profile.city_name||!profile.adult_confirmed||!profile.boundaries_accepted)return;
 const {data:prefs,error:prefErr}=await client.from('nearby_alert_preferences')
  .select('in_app_enabled,push_enabled').eq('user_id',user.id).maybeSingle();
 if(prefErr||prefs?.in_app_enabled===false)return;
 const today=new Date(Date.now()+330*60000).toISOString().slice(0,10);
 const todayStart=new Date(today+'T00:00:00+05:30').toISOString();
 const {data:notices,error:noticeErr}=await client.from('notifications')
  .select('id,link,created_at').eq('user_id',user.id).eq('kind','nearby')
  .gte('created_at',todayStart).order('created_at',{ascending:false}).limit(60);
 if(noticeErr||!notices?.length)return;
 const seen=previouslySeen(user.id);
 const firstById=new Map();
 for(const n of notices){
  const id=String(n.link||'').match(/^companion\.html\?id=([0-9a-f-]{36})$/i)?.[1];
  if(!id||!uuid.test(id)||seen.has(n.id)||firstById.has(id))continue;
  firstById.set(id,n);
 }
 if(!firstById.size)return;
 const [listingRes,selfRegion,blockRes]=await Promise.all([
  client.from('companion_listings')
   .select('user_id,public_id,display_name,photo_path,categories,city_name,location_id,adult_confirmed,boundaries_accepted,published,moderation_status')
   .in('public_id',[...firstById.keys()]).eq('published',true).eq('moderation_status','active'),
  client.from('profile_locations').select('state,district').eq('id',profile.location_id).maybeSingle(),
  client.from('user_blocks').select('blocker_id,blocked_id')
   .or('blocker_id.eq.'+user.id+',blocked_id.eq.'+user.id)
 ]);
 if(listingRes.error||selfRegion.error||blockRes.error||!selfRegion.data)return;
 const blocked=new Set((blockRes.data||[]).map(b=>b.blocker_id===user.id?b.blocked_id:b.blocker_id));
 const listings=(listingRes.data||[]).filter(p=>p.user_id!==user.id&&!blocked.has(p.user_id)&&
   p.adult_confirmed&&p.boundaries_accepted&&normal(p.city_name)===normal(profile.city_name));
 const locIds=[...new Set(listings.map(p=>p.location_id).filter(Boolean))];
 if(!locIds.length)return;
 const {data:locs,error:locErr}=await client.from('profile_locations')
  .select('id,state,district').in('id',locIds);
 if(locErr)return;
 const locations=new Map((locs||[]).map(r=>[r.id,r]));
 const items=listings.filter(p=>{
  const loc=locations.get(p.location_id);
  return loc?.state===selfRegion.data.state&&loc?.district===selfRegion.data.district;
 }).map(p=>{
  const loc=locations.get(p.location_id);
  const asset=avatarAsset(p.photo_path);
  const photo=asset||(p.photo_path?client.storage.from('listing-photos').getPublicUrl(p.photo_path).data.publicUrl:'');
  return {listing:p,notification_id:firstById.get(p.public_id).id,photo,state:loc.state,district:loc.district,
   created_at:firstById.get(p.public_id).created_at};
 }).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,12);
 if(!items.length)return;
 renderPopup(client,user,prefs,items);
}
void init().catch(()=>{});
