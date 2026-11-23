import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {enableNearbyDevicePush} from './push-settings.js?v=20261025-polish-1';
const boxes=[...document.querySelectorAll('[data-nearby-alert-settings]')];
let client,user;
function feedback(box,text,problem=false){
 const status=box.querySelector('[data-nearby-status]');
 if(status){status.textContent=text;status.dataset.error=String(problem)}
}
async function setup(box){
 const form=box.querySelector('[data-nearby-form]');
 const inApp=form.querySelector('[name="in_app_enabled"]');
 const push=form.querySelector('[name="push_enabled"]');
 const button=form.querySelector('button[type="submit"]');
 const location=box.querySelector('[data-nearby-location]');
 form.hidden=true;location.textContent='';
 box.querySelector('[data-nearby-signin]').hidden=true;
 box.querySelector('[data-nearby-profile]').hidden=true;
 feedback(box,'Loading nearby alert settings…');
 if(!user){
  feedback(box,'Sign in to manage nearby discovery. Nearby emails have been discontinued.');
  box.querySelector('[data-nearby-signin]').hidden=false;return;
 }
 const [profile,prefs]=await Promise.all([
  client.from('member_profiles').select('city_name,location_id,adult_confirmed,boundaries_accepted').eq('user_id',user.id).maybeSingle(),
  client.from('nearby_alert_preferences').select('in_app_enabled,push_enabled').eq('user_id',user.id).maybeSingle()
 ]);
 if(profile.error||prefs.error)throw Error('Could not load nearby notification settings.');
 const p=profile.data;
 if(!p?.city_name||!p?.location_id||!p.adult_confirmed||!p.boundaries_accepted){
  feedback(box,'Save your city, state and district in My Profile first to receive local updates.');
  box.querySelector('[data-nearby-profile]').hidden=false;return;
 }
 const {data:region,error:regionError}=await client.from('profile_locations').select('state,district').eq('id',p.location_id).maybeSingle();
 if(regionError||!region)throw Error('Could not read your saved location.');
 location.textContent='Matching: '+p.city_name+', '+region.district+', '+region.state;
 inApp.checked=prefs.data?.in_app_enabled??true;
 push.checked=!!prefs.data?.push_enabled;
 form.hidden=false;
 feedback(box,'Website nearby updates are ON by default. Browser push needs your explicit permission. No nearby emails are sent.');
 form.onsubmit=async e=>{
  e.preventDefault();button.disabled=true;feedback(box,'Saving choices…');
  try{
   if(push.checked)await enableNearbyDevicePush();
   const result=await client.auth.getUser();
   if(result.error||result.data.user?.id!==user.id)throw Error('Session expired. Please sign in again.');
   const {error}=await client.from('nearby_alert_preferences').upsert({
    user_id:user.id,in_app_enabled:inApp.checked,push_enabled:push.checked,
    email_enabled:false,updated_at:new Date().toISOString()
   },{onConflict:'user_id'});
   if(error)throw error;
   feedback(box,'Saved! '+(push.checked?'Chrome nearby push alerts ON. ':'Chrome nearby push alerts OFF. ')+(inApp.checked?'Website alerts ON.':'Website alerts OFF.')+' Nearby emails are permanently off.');
  }catch(err){feedback(box,err.message||'Could not save nearby alerts.',true)}
  finally{button.disabled=false}
 };
}
async function init(){
 if(!boxes.length)return;
 try{
  client=await getSathivoClient();
  const {data,error}=await client.auth.getUser();
  if(error)throw error;user=data.user||null;
  await Promise.all(boxes.map(setup));
  client.auth.onAuthStateChange((event,session)=>{
   if(event!=='SIGNED_IN'&&event!=='SIGNED_OUT')return;
   user=session?.user||null;
   Promise.resolve().then(()=>Promise.all(boxes.map(setup)))
    .catch(e=>boxes.forEach(box=>feedback(box,e.message||'Could not refresh settings.',true)));
  });
 }catch(e){boxes.forEach(box=>feedback(box,e.message||'Nearby settings unavailable.',true))}
}
void init();
