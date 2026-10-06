const labels={plan_changed:'Plan changed',time_issue:'Timing issue',safety_concern:'Safety concern',other:'Other'};

export function cancellationLabel(reason){
 return labels[reason]||'Cancelled';
}

export function askCancellationReason(){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='cancel-dialog';
  const form=document.createElement('form');form.method='dialog';form.className='cancel-dialog-card';
  const title=document.createElement('h2');title.textContent='Cancel this booking?';
  const intro=document.createElement('p');intro.textContent='Choose a short reason. The other person and Sathivo admin can see the cancellation reason.';
  const select=document.createElement('select');select.required=true;select.innerHTML='<option value="">Choose a reason</option><option value="plan_changed">Plan changed</option><option value="time_issue">Timing issue</option><option value="safety_concern">Safety concern</option><option value="other">Other</option>';
  const note=document.createElement('textarea');note.maxLength=300;note.rows=3;note.placeholder='Optional note (required for Other)';
  const actions=document.createElement('div');actions.className='cancel-dialog-actions';
  const back=document.createElement('button');back.type='button';back.className='button button-outline';back.textContent='Keep booking';
  const confirm=document.createElement('button');confirm.type='submit';confirm.className='button danger-button';confirm.textContent='Cancel booking';
  actions.append(back,confirm);form.append(title,intro,select,note,actions);dialog.append(form);document.body.append(dialog);
  let result=null;
  back.onclick=()=>dialog.close('keep');
  form.onsubmit=e=>{e.preventDefault();const reason=select.value,copy=note.value.trim();if(!reason){select.focus();return}if(reason==='other'&&copy.length<3){note.setCustomValidity('Add a short note for Other.');note.reportValidity();note.setCustomValidity('');return}result={reason,note:copy};dialog.close('cancel')};
  dialog.addEventListener('close',()=>{dialog.remove();resolve(dialog.returnValue==='cancel'?result:null)},{once:true});
  dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close('keep')});
  dialog.showModal();
 });
}
