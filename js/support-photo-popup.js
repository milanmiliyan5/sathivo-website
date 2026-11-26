// Account-scoped support follow-up. Only the owner can read/acknowledge their notice.
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
const campaign='support-photo-retry-v1';
let client,dialog=null,timer=null,checking=false,finishedFor=null,disposed=false;
const ready=()=>!document.hidden&&!document.documentElement.classList.contains('sathivo-entry-pending')&&!document.querySelector('.sathivo-launch-screen, dialog[open]');
function schedule(ms=3000){clearTimeout(timer);if(!disposed)timer=setTimeout(()=>void check().catch(()=>{}),ms);}
function hide(){if(!dialog)return;const d=dialog;dialog=null;if(d.open)d.close();d.remove();}
function show(notice,user){
 const d=document.createElement('dialog');d.className='sathivo-thanks-popup sathivo-photo-support-popup';
 d.setAttribute('aria-labelledby','support-photo-title');
 d.innerHTML='<div class="stp-head"><div class="stp-brand"><div><strong>Sathivo Support</strong></div></div><button type="button" class="stp-close" aria-label="Close">×</button></div>'+
 '<div class="stp-body"><div class="stp-heart" aria-hidden="true">📷</div><h2 id="support-photo-title"></h2><p class="support-photo-copy"></p><p class="stp-comfort">Thank you for helping us improve Sathivo. ❤️</p>'+
 '<button type="button" class="stp-continue">Upload Profile Photo</button><button type="button" class="support-photo-later">Maybe later</button><p class="stp-error" role="alert"></p></div>';
 d.querySelector('h2').textContent=notice.title;
 d.querySelector('.support-photo-copy').textContent=notice.body;
 const upload=d.querySelector('.stp-continue'),later=d.querySelector('.support-photo-later'),close=d.querySelector('.stp-close'),err=d.querySelector('.stp-error');
 later.style.cssText='display:block;margin:10px auto 2px;background:none;border:0;color:#765864;font:inherit;font-size:13px;cursor:pointer;padding:7px 14px;';
 let saving=false;
 async function acknowledge(go){
  if(saving)return;saving=true;upload.disabled=later.disabled=close.disabled=true;err.textContent='';
  try{
   const identity=await client.auth.getUser();if(identity.error||identity.data?.user?.id!==user.id)throw Error('Session changed');
   const result=await client.from('website_notifications').update({read_at:new Date().toISOString()})
    .eq('id',notice.id).eq('user_id',user.id).eq('campaign_key',campaign).is('read_at',null);
   if(result.error)throw result.error;
   finishedFor=user.id;hide();
   if(go)location.assign('profile.html#companion-photo-section');
  }catch{err.textContent='Could not save. Please try again.';upload.disabled=later.disabled=close.disabled=false;}
  finally{saving=false;}
 }
 upload.addEventListener('click',()=>void acknowledge(true));
 later.addEventListener('click',()=>void acknowledge(false));
 close.addEventListener('click',()=>void acknowledge(false));
 d.addEventListener('cancel',e=>{e.preventDefault();void acknowledge(false);});
 d.addEventListener('close',()=>{if(dialog===d)dialog=null;d.remove();},{once:true});
 dialog=d;document.body.append(d);try{d.showModal();}catch{hide();}
}
async function check(){
 if(!client||checking||disposed||document.hidden||dialog?.open)return;
 checking=true;
 try{
  const session=await client.auth.getSession();const user=session.data?.session?.user;
  if(session.error||!user||finishedFor===user.id)return;
  const {data,error}=await client.from('website_notifications').select('id,title,body')
   .eq('user_id',user.id).eq('campaign_key',campaign).is('read_at',null).limit(1).maybeSingle();
  if(error||!data)return;
  if(!ready()){schedule(1500);return;}
  const identity=await client.auth.getUser();if(identity.error||identity.data?.user?.id!==user.id||disposed)return;
  if(!ready()){schedule(1500);return;}
  show(data,user);
 }finally{checking=false;}
}
(async()=>{
 try{
  client=await getSathivoClient();
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){finishedFor=null;hide();}if(event==='SIGNED_IN')schedule();});
  schedule();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(timer);hide();});
  window.addEventListener('pageshow',e=>{if(e.persisted){disposed=false;schedule();}});
 }catch{}
})();
