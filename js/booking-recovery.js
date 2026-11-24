// Recovery is validated by the database; the browser only presents controls.
export async function confirmCompletion(){
 const dialog=document.createElement('dialog');
 dialog.className='booking-success-dialog';
 dialog.setAttribute('aria-label','Complete this booking?');
 dialog.innerHTML='<div class="booking-success-content"><h2>Complete this booking?</h2><p>Confirm only after your planned activity is finished. This marks the booking completed and makes the chat read-only. You can undo an accidental completion within 30 seconds or request to reopen later.</p><div class="booking-success-actions"><button type="button" class="button button-outline" data-back>Go back</button><button type="button" class="button button-primary" data-confirm>Confirm Completion</button></div></div>';
 document.body.append(dialog);
 if(typeof dialog.showModal!=='function'){dialog.remove();return window.confirm('Complete this booking? Active chat will close.')}
 return new Promise(resolve=>{
  let yes=false;
  dialog.querySelector('[data-back]').onclick=()=>dialog.close();
  dialog.querySelector('[data-confirm]').onclick=()=>{yes=true;dialog.close()};
  dialog.addEventListener('close',()=>{dialog.remove();resolve(yes)},{once:true});
  dialog.showModal();dialog.querySelector('[data-back]').focus();
 });
}
export function recoveryOptions(row,uid,now=Date.now()){
 if(row.status!=='completed'||![row.customer_id,row.companion_id].includes(uid))return [];
 const options=[];
 const end=Date.parse(row.completed_at)+30000;
 if(row.completed_by===uid&&Number.isFinite(end)&&now<end) options.push('undo');
 if(row.reopen_request_state==='pending'){
  if(row.reopen_requested_by!==uid)options.push('approve','decline');
 }else if(!['declined','reopened'].includes(row.reopen_request_state))options.push('request');
 return options;
}
const labels={undo:'Undo completion (30 sec)',request:'Request to reopen',approve:'Accept reopen request',decline:'Decline reopen request'};
export function appendRecoveryControls(container,row,uid,onAction){
 if(row.status!=='completed')return;
 const add=(tag,copy)=>{const n=document.createElement(tag);n.textContent=copy;return n};
 if(row.reopen_request_state==='pending'){
  const p=add('p',row.reopen_requested_by===uid?'Reopen requested. Waiting for the other person.':'The other person would like to reopen this booking.');p.className='launch-note';container.append(p);
 }else if(row.reopen_request_state==='declined'){
  const p=add('p','Reopen request declined. This booking remains completed.');p.className='launch-note';container.append(p);
 }
 for(const action of recoveryOptions(row,uid)){
  const b=add('button',labels[action]);b.type='button';b.className='button button-outline';
  b.onclick=async()=>{
   if(action!=='undo'&&!window.confirm(action==='request'?'Ask the other participant to reopen this booking?':action==='approve'?'Reopen this booking and resume active chat?':'Decline this reopen request?'))return;
   b.disabled=true;try{await onAction(row.id,action)}finally{b.disabled=false}
  };
  container.append(b);
  if(action==='undo')setTimeout(()=>b.remove(),Math.max(0,Date.parse(row.completed_at)+30000-Date.now()));
 }
}
export async function runRecovery(client,id,action,reason=null){
 const {data,error}=await client.rpc('booking_recovery_action',{p_booking_id:id,p_action:action,p_reason:reason});
 if(error)throw error;
 return data;
}

export function completionState(row,uid){
 return row?.status==='accepted'&&!!uid&&row.companion_id===uid?'ready':'unavailable';
}
export function completionLabel(row,uid,chat=false){
 return chat?'Click here to complete your booking':'Mark completed';
}
export async function submitCompletion(client,id){
 const {data,error}=await client.rpc('confirm_booking_completion',{p_booking_id:id});
 if(error)throw error;
 if(data!=='completed')throw Error('Completion status unavailable');
 return data;
}
