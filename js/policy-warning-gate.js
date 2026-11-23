// Account-specific mandatory policy warning. Server-side triggers enforce the lock.
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
let client,dialog,checking=false,shownFor=null;
const $=(selector,root=document)=>root.querySelector(selector);
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
function closeGate(){
 if(dialog){if(dialog.open)dialog.close();dialog.remove();dialog=null}
 shownFor=null;document.documentElement.classList.remove('sathivo-policy-gate-open');
}
function display(w,user){
 if(dialog?.open&&shownFor===user.id)return;
 closeGate();shownFor=user.id;
 const d=make('dialog','sathivo-warning-gate');
 d.setAttribute('aria-labelledby','policy-warning-title');
 d.innerHTML='<header class="swg-brand"><span aria-hidden="true">🛡️</span><div><strong>Sathivo Trust &amp; Safety</strong><small>Official Account Notice</small></div></header>'+
 '<section class="swg-content"><div class="swg-title"><span aria-hidden="true">⚠️</span><h2 id="policy-warning-title">Community Guidelines Warning</h2><p>Formal Policy Notice</p></div>'+
 '<p class="swg-greeting"></p>'+
 '<p>Our Trust &amp; Safety Team reviewed your recent booking conversation and confirmed a violation of Sathivo’s strictly platonic companionship policy.</p>'+
 '<p>Sexual proposals, hookup requests, harassment and inappropriate behaviour are prohibited on Sathivo.</p>'+
 '<p><strong>This is your formal warning.</strong></p>'+
 '<p>Any further confirmed violation may lead to immediate suspension or permanent account removal without another warning.</p>'+
 '<p>Please respect everyone’s personal boundaries and follow our Community Guidelines.</p></section>'+
 '<form class="swg-form"><label class="swg-check"><input type="checkbox" required><span>I understand and agree to follow Sathivo’s Community Guidelines.</span></label>'+
 '<button type="submit" class="swg-continue" disabled>I Understand &amp; Continue</button><p class="swg-error" role="alert"></p></form>'+
 '<footer class="swg-footer"><div><button class="swg-signout" type="button">Sign out</button><a href="support.html">Contact Support</a><a href="delete-account.html">Delete Account</a></div><small>Sathivo Trust &amp; Safety Team · sathivo.co</small></footer>';
 $('.swg-greeting',d).textContent='Dear '+String(w.display_name||'Member').trim()+',';
 const tick=$('input[type="checkbox"]',d),btn=$('.swg-continue',d),error=$('.swg-error',d),logout=$('.swg-signout',d);
 tick.addEventListener('change',()=>{btn.disabled=!tick.checked});
 d.addEventListener('cancel',e=>e.preventDefault()); // Escape cannot dismiss
 d.addEventListener('click',e=>{if(e.target===d)e.preventDefault()}); // backdrop cannot dismiss
 $('.swg-form',d).addEventListener('submit',async e=>{
  e.preventDefault();if(!tick.checked||btn.disabled)return;
  tick.disabled=true;btn.disabled=true;logout.disabled=true;btn.textContent='Saving acknowledgment…';error.textContent='';
  try{
   const current=await client.auth.getUser();
   if(current.error||current.data.user?.id!==user.id)throw Error('Session changed. Sign in again.');
   const r=await client.rpc('sathivo_acknowledge_policy_warning',{p_warning_id:w.id,p_agreed:true});
   if(r.error||r.data!==true)throw Error(r.error?.message||'Could not save acknowledgment.');
   closeGate();window.location.reload(); // reload account after trusted database update
  }catch(err){
   error.textContent=err.message||'Connection error. Please retry.';
   tick.disabled=false;btn.disabled=!tick.checked;logout.disabled=false;btn.textContent='I Understand & Continue';
  }
 });
 logout.addEventListener('click',async()=>{
  logout.disabled=true;error.textContent='';
  const r=await client.auth.signOut({scope:'local'});
  if(r.error){error.textContent='Could not sign out. Please retry.';logout.disabled=false;return}
  closeGate();location.replace('account.html#login');
 });
 dialog=d;document.body.append(d);document.documentElement.classList.add('sathivo-policy-gate-open');
 try{d.showModal()}catch{closeGate()}
}
async function check(){
 if(checking||!client)return;checking=true;
 try{
  const identity=await client.auth.getUser(),user=identity.data?.user;
  if(identity.error||!user){closeGate();return}
  if(shownFor===user.id&&dialog?.open)return;
  const r=await client.from('account_policy_warnings').select('id,display_name,issued_at')
   .eq('user_id',user.id).is('acknowledged_at',null).order('issued_at',{ascending:false}).limit(1).maybeSingle();
  if(r.error){console.warn('Could not check account policy warning');return}
  if(!r.data){closeGate();return}
  if(document.readyState==='loading')await new Promise(res=>document.addEventListener('DOMContentLoaded',res,{once:true}));
  display(r.data,user);
 }finally{checking=false}
}
(async()=>{
 try{
  client=await getSathivoClient();
  client.auth.onAuthStateChange(event=>{
   if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))setTimeout(()=>void check().catch(()=>{}),0);
  });
  await check();window.addEventListener('pageshow',()=>void check().catch(()=>{}));
 }catch{/* Server-enforced write restrictions remain active if offline. */}
})();
