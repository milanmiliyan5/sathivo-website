// One-time Sathivo Trust & Safety thanks. Recipients are controlled server-side by RLS.
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
let client,dialog=null,checking=false,timer=null;
function select(q,root=document){return root.querySelector(q)}
function schedule(delay=650){
 if(timer)clearTimeout(timer);
 timer=setTimeout(()=>{timer=null;void check().catch(()=>{})},delay);
}
function hide(){
 if(!dialog)return;
 const current=dialog;
 dialog=null;
 if(current.open)current.close();
 current.remove();
}
function show(notice,user){
 if(dialog?.open)return;
 const d=document.createElement('dialog');
 d.className='sathivo-thanks-popup';
 d.setAttribute('aria-labelledby','sathivo-thanks-title');
 d.innerHTML=[
 '<div class="stp-head"><div class="stp-brand"><span aria-hidden="true">🛡️</span>',
 '<div><strong>Sathivo Trust &amp; Safety</strong><small>Safety Report Update</small></div></div>',
 '<button type="button" class="stp-close" aria-label="Close thank you message">×</button></div>',
 '<div class="stp-body"><div class="stp-heart" aria-hidden="true">💗</div>',
 '<h2 id="sathivo-thanks-title">Thank You, <span class="stp-name"></span>!</h2>',
 '<p class="stp-subtitle">Your voice helps keep Sathivo safe.</p>',
 '<p>We reviewed your report and issued a <strong>formal warning</strong> to the reported user.</p>',
 '<p>Further confirmed violations may result in <strong>permanent account removal.</strong></p>',
 '<p class="stp-comfort">Your safety matters to us. ❤️</p>',
 '<button type="button" class="stp-continue">Thank You &amp; Continue</button>',
 '<p class="stp-error" role="alert" aria-live="polite"></p></div>',
 '<p class="stp-signature">Sathivo Trust &amp; Safety Team · sathivo.co</p>'
 ].join('');
 select('.stp-name',d).textContent=String(notice.recipient_name||'Member').trim().split(/\s+/)[0]||'Member';
 const x=select('.stp-close',d),btn=select('.stp-continue',d),err=select('.stp-error',d);
 let saving=false;
 async function acknowledge(){
  if(saving)return;
  saving=true;x.disabled=true;btn.disabled=true;btn.textContent='Saving…';err.textContent='';
  try{
   const identity=await client.auth.getUser();
   if(identity.error||identity.data.user?.id!==user.id)throw Error('Session changed');
   const response=await client.rpc('sathivo_acknowledge_safety_thanks',{p_notice_id:notice.id});
   if(response.error||response.data!==true)throw Error(response.error?.message||'Save failed');
   hide();
  }catch{
   err.textContent='Could not save yet. Please try again.';
   x.disabled=false;btn.disabled=false;btn.textContent='Thank You & Continue';
  }finally{saving=false}
 }
 x.addEventListener('click',()=>void acknowledge());
 btn.addEventListener('click',()=>void acknowledge());
 d.addEventListener('cancel',e=>{e.preventDefault();void acknowledge()});
 d.addEventListener('click',e=>{if(e.target===d)e.preventDefault()});
 d.addEventListener('close',()=>{if(dialog===d)dialog=null;d.remove()},{once:true});
 dialog=d;document.body.append(d);
 try{d.showModal()}catch{hide()}
}
async function check(){
 if(checking||!client||document.hidden)return;
 checking=true;
 try{
  const identity=await client.auth.getUser();
  const user=identity.data?.user;
  if(identity.error||!user){hide();return}
  if(dialog?.open)return;
  const {data,error}=await client.from('safety_report_thanks')
   .select('id,recipient_name,issued_at').eq('user_id',user.id).is('seen_at',null)
   .order('issued_at',{ascending:false}).limit(1).maybeSingle();
  if(error||!data)return;
  if(document.readyState==='loading')
   await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  if(document.hidden)return;
  if(document.querySelector('dialog[open]')){schedule(1900);return}
  show(data,user);
 }finally{checking=false}
}
(async()=>{
 try{
  client=await getSathivoClient();
  client.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_OUT')hide();
   if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))schedule(450);
  });
  schedule(900);
  window.addEventListener('pageshow',()=>schedule(650));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(650)});
 }catch{/* Auth/server unavailable: do not show an unverified popup. */}
})();
