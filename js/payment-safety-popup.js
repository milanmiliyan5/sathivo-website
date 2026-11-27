// Per-booking companion-only payment safety reminder. Never sends a chat message.
const table='booking_payment_safety_acknowledgements';
export const paymentSafetyEligible=(booking,uid)=>Boolean(uid&&booking?.id&&booking.status==='accepted'&&booking.companion_id===uid&&booking.customer_id!==uid);
const icons=['M21 11a8 8 0 0 1-8 8H3l2-5a8 8 0 1 1 16-3Z','M3 8V5l14-3v3M21 11h-6v5h6M4 5h16a1 1 0 0 1 1 1v13H3V8','M8 12l3 3 5-6'];
const svg=(path,extra='')=>'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+extra+'<path d="'+path+'"/></svg>';
const steps=[['Discuss Payment','Agree on the amount first.'],['Receive Payment','Collect via UPI, QR or UPI-linked number.'],['Start Your Session','Verify payment before paid chats or meetings.']];
let active=null,checking=false,confirmed=new Set(),retry=null;
function show({client,uid,booking,manual,isCurrent}){
 if(active?.open||!isCurrent())return;
 const d=document.createElement('dialog');d.className='payment-safety-dialog';
 d.setAttribute('aria-labelledby','payment-safety-title');
 d.innerHTML='<div class="ps-icon">'+svg('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4')+'</div><h2 id="payment-safety-title">Your Time Matters</h2><p class="ps-intro">Receive your payment before starting your paid session.</p>'+steps.map(([title,detail],i)=>'<div class="ps-step">'+svg(icons[i],i===2?'<circle cx="12" cy="12" r="9"/>':'')+'<div><strong>'+title+'</strong><small>'+detail+'</small></div></div>').join('')+'<button type="button" class="ps-continue">I Understand, Continue</button><p class="ps-note">Payments are handled directly between users and are not guaranteed by Sathivo.</p><p class="ps-error" role="alert" hidden></p><button type="button" class="ps-dismiss" hidden>Close for now</button>';
 const button=d.querySelector('.ps-continue'),err=d.querySelector('.ps-error'),dismiss=d.querySelector('.ps-dismiss');
 const key=uid+':'+booking.id;
 async function acknowledge(){
  if(button.disabled)return;
  if(!isCurrent()){d.close();return;}
  if(manual&&confirmed.has(key)){d.close();return;}
  button.disabled=true;button.textContent='Saving…';err.hidden=true;
  try{
   const identity=await client.auth.getUser();
   if(identity.error||identity.data?.user?.id!==uid||!isCurrent())throw Error('Session changed');
   const result=await client.from(table).insert({booking_id:booking.id,user_id:uid});
   if(result.error&&result.error.code!=='23505')throw result.error;
   confirmed.add(key);d.close();
  }catch{err.textContent='Could not save the reminder. Retry or close for now.';err.hidden=false;dismiss.hidden=false;}
  finally{button.disabled=false;button.textContent='I Understand, Continue';}
 }
 button.addEventListener('click',()=>void acknowledge());
 dismiss.addEventListener('click',()=>d.close());
 d.addEventListener('cancel',e=>{e.preventDefault();if(!button.disabled)void acknowledge()});
 d.addEventListener('close',()=>{if(active===d)active=null;d.remove()},{once:true});
 document.body.append(d);active=d;
 try{d.showModal()}catch{active=null;d.remove()}
}
export async function checkPaymentSafety({client,uid,booking,manual=false,isCurrent=()=>true}){
 if(!paymentSafetyEligible(booking,uid)||!isCurrent()||document.hidden||active?.open||checking)return;
 const key=uid+':'+booking.id;
 if(!manual&&confirmed.has(key))return;
 if(document.querySelector('dialog[open]')){
  if(!manual&&!retry)retry=setTimeout(()=>{retry=null;void checkPaymentSafety({client,uid,booking,isCurrent})},1500);
  return;
 }
 checking=true;
 try{
  if(!confirmed.has(key)){
   const {data,error}=await client.from(table).select('booking_id').eq('booking_id',booking.id).eq('user_id',uid).maybeSingle();
   if(error&&!manual)return;
   if(data)confirmed.add(key);
  }
  if(!isCurrent()||(!manual&&confirmed.has(key)))return;
  if(document.querySelector('dialog[open]')){
   if(!manual&&!retry)retry=setTimeout(()=>{retry=null;void checkPaymentSafety({client,uid,booking,isCurrent})},1500);
   return;
  }
  show({client,uid,booking,manual,isCurrent});
 }catch{/* Reminder must never break the existing chat. */}
 finally{checking=false}
}
