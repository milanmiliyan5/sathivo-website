import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {ACTIVITY_ANNOUNCEMENT_DELAY_MS,ACTIVITY_ANNOUNCEMENT_TARGET,canShowActivityAnnouncement} from './activity-update-announcement-policy.js?v=20261122-1';

// Existing companion members only. A single atomic database update reserves the
// announcement per account, so it does not reappear on another browser/device.
// This script is loaded on Home, Explore and the logged-in Account page, never
// on the editable Profile page or inside an in-progress booking/chat.
const TABLE='companion_activity_update_prompts';
let client=null,timer=null,working=false,disposed=false,pendingDialog=null,openDialog=null,retries=0;
const checkedUserIds=new Set();
const safe=()=>canShowActivityAnnouncement(document,window.location);
function schedule(ms){
 if(disposed||timer!==null)return;
 timer=window.setTimeout(()=>{timer=null;void attempt()},ms);
}
function defer(){
 retries+=1;
 if(retries<=30)schedule(2000);
}
function createPopup(){
 const d=document.createElement('dialog');
 d.className='activity-update-announcement';
 d.id='activity-update-announcement';
 d.setAttribute('aria-labelledby','activity-update-title');
 d.setAttribute('aria-describedby','activity-update-description');
 d.innerHTML=`<div class="activity-update-inner">
   <button class="activity-update-close" type="button" aria-label="Close new activities announcement">×</button>
   <div class="activity-update-icon" aria-hidden="true">✦</div>
   <span class="activity-update-kicker">WHAT'S NEW · SATHIVO</span>
   <h2 id="activity-update-title">More Ways to Connect on Sathivo! <span aria-hidden="true">♡</span></h2>
   <p id="activity-update-description">We’ve added <strong>13 new activities</strong>! From Study Partner and Digital Help to Gaming, Photography and City Exploration — discover more ways to share what you love.</p>
   <p class="activity-update-reassurance">Your existing activities are saved. Just choose any new ones you want to offer.</p>
   <p class="activity-update-safety">Hospital visits and senior companionship are for planned, non-medical social company only — not emergency or nursing services.</p>
   <a class="activity-update-cta" href="${ACTIVITY_ANNOUNCEMENT_TARGET}">✦ Explore New Activities <span aria-hidden="true">↗</span></a>
   <button class="activity-update-later" type="button">Maybe Later</button>
  </div>`;
 const previous=document.activeElement;
 const close=()=>{if(d.open)d.close()};
 d.querySelector('.activity-update-close').addEventListener('click',close);
 d.querySelector('.activity-update-later').addEventListener('click',close);
 d.querySelector('.activity-update-cta').addEventListener('click',close);
 d.addEventListener('click',event=>{if(event.target===d)close()});
 d.addEventListener('close',()=>{
  d.remove();
  if(openDialog===d)openDialog=null;
  if(previous?.isConnected)previous.focus({preventScroll:true});
 },{once:true});
 return d;
}
function displayClaimedPopup(){
 if(!pendingDialog||disposed)return;
 if(!safe()){defer();return}
 const d=pendingDialog;pendingDialog=null;
 if(typeof d.showModal!=='function')return;
 document.body.append(d);
 try{
  d.showModal();
  openDialog=d;
  d.querySelector('.activity-update-cta')?.focus({preventScroll:true});
 }catch{
  d.remove();
 }
}
async function attempt(){
 if(disposed||working)return;
 if(pendingDialog){displayClaimedPopup();return}
 if(!safe()){defer();return}
 working=true;
 try{
  client=client||await getSathivoClient();
  // Guests are never queried for eligibility or shown the announcement.
  const {data:session,error:sessionError}=await client.auth.getSession();
  if(sessionError||!session?.session?.user)return;
  const {data:identity,error:identityError}=await client.auth.getUser();
  const user=identity?.user;
  if(identityError||!user?.id||checkedUserIds.has(user.id))return;
  if(!safe()){defer();return}

  // Updating a not-yet-shown seeded row is an atomic, RLS-limited claim.
  // New accounts/customers have no row. A different tab/device gets 0 rows.
  const {data:claimed,error}=await client.from(TABLE)
   .update({shown_at:new Date().toISOString()})
   .eq('user_id',user.id)
   .is('shown_at',null)
   .select('user_id');
  if(error){console.warn('Sathivo activity notice could not be checked:',error.message);return}
  checkedUserIds.add(user.id);
  if(!claimed?.length)return;
  pendingDialog=createPopup();
  displayClaimedPopup();
 }catch(error){
  console.warn('Sathivo activity notice unavailable:',error?.message||'Network issue');
 }finally{working=false}
}
async function init(){
 if(disposed)return;
 schedule(ACTIVITY_ANNOUNCEMENT_DELAY_MS);
 try{
  client=await getSathivoClient();
  client.auth.onAuthStateChange((event,session)=>{
   // Never do Supabase requests inside an auth-state callback.
   if(event==='SIGNED_OUT'){
    if(timer!==null)clearTimeout(timer);
    timer=null;pendingDialog=null;
    if(openDialog?.open)openDialog.close();
   }else if(event==='SIGNED_IN'&&session?.user?.id){
    schedule(ACTIVITY_ANNOUNCEMENT_DELAY_MS);
   }
  });
 }catch{ /* Unavailable auth means no unsolicited announcement. */ }
 window.addEventListener('pagehide',()=>{
  disposed=true;if(timer!==null)clearTimeout(timer);timer=null;
 },{once:true});
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void init(),{once:true});
 else void init();
}
