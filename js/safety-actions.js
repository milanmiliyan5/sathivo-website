// Shared, user-initiated safety actions. Existing RLS protects reports/blocks.
const reasons=[
 ['harassment','Harassment or abusive behaviour'],
 ['sexual-content','Sexual or inappropriate request'],
 ['fake-profile','Fake or misleading profile'],
 ['scam','Scam or payment fraud'],
 ['spam','Spam or unwanted contact'],
 ['safety','Personal safety concern'],
 ['other','Other safety concern']
];
const make=(tag,text,cls)=>{
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=text;
 if(cls)node.className=cls;
 return node;
};
const openDialog=(dialog,resolve)=>{
 document.body.append(dialog);
 dialog.addEventListener('close',()=>{dialog.remove();resolve(dialog.returnValue==='submitted')},{once:true});
 dialog.showModal();
};
export function openSafetyReport({client,reporterId,reportedUserId,bookingId=null}){
 return new Promise(resolve=>{
  if(!client||!reporterId||!reportedUserId||reporterId===reportedUserId){resolve(false);return;}
  const dialog=make('dialog',undefined,'sathivo-safety-dialog');
  const form=make('form',undefined,'sathivo-safety-form');
  form.noValidate=true;
  const heading=make('h2','Report a safety concern');
  heading.id='safety-report-heading';
  dialog.setAttribute('aria-labelledby',heading.id);
  const intro=make('p','Choose a reason and tell our team what happened. Your report goes to Sathivo admins for review. The other person will not see your report details.');
  const label=make('label','Why are you reporting this user?');
  const select=make('select');
  select.required=true;select.name='reason';
  const blank=make('option','Select a reason');blank.value='';select.append(blank);
  reasons.forEach(([value,title])=>{const opt=make('option',title);opt.value=value;select.append(opt)});
  label.append(select);
  const detailsLabel=make('label','Tell us more (optional)');
  const details=make('textarea');details.rows=4;details.maxLength=1500;details.name='details';details.placeholder='Describe what happened. Do not include passwords, OTPs or card details.';
  detailsLabel.append(details);
  const note=make('p','Submitting a report does not automatically block this person or cancel a booking. For immediate danger, contact local emergency services.','sathivo-safety-fineprint');
  const message=make('p','', 'sathivo-safety-feedback');
  message.setAttribute('role','alert');
  const actions=make('div',undefined,'sathivo-safety-dialog-actions');
  const cancel=make('button','Not now','button button-outline');cancel.type='button';
  const submit=make('button','Submit report','button button-primary');submit.type='submit';
  actions.append(cancel,submit);
  form.append(heading,intro,label,detailsLabel,note,message,actions);
  dialog.append(form);
  cancel.onclick=()=>dialog.close('cancelled');
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!select.value){message.textContent='Please select a reason.';select.focus();return;}
   submit.disabled=true;cancel.disabled=true;submit.textContent='Submitting…';message.textContent='';
   try{
    const entry={reporter_id:reporterId,reported_user_id:reportedUserId,reason:select.value,details:details.value.trim()};
    if(bookingId)entry.booking_id=bookingId;
    const {error}=await client.from('user_reports').insert(entry);
    if(error)throw error;
    dialog.close('submitted');
   }catch(error){
    message.textContent='Could not send your report. Please try again or contact Sathivo Support.';
    console.warn('Sathivo safety report error:',error);
   }finally{submit.disabled=false;cancel.disabled=false;submit.textContent='Submit report';}
  });
  openDialog(dialog,resolve);
 });
}
export function confirmSafetyBlock(){
 return new Promise(resolve=>{
  const dialog=make('dialog',undefined,'sathivo-safety-dialog');
  const body=make('div',undefined,'sathivo-safety-form');
  const heading=make('h2','Block this user?');
  heading.id='safety-block-heading';dialog.setAttribute('aria-labelledby',heading.id);
  const intro=make('p','Blocking stops further messaging with this person. It does not cancel an existing booking or automatically send a report.');
  const actions=make('div',undefined,'sathivo-safety-dialog-actions');
  const cancel=make('button','Keep unblocked','button button-outline');
  const yes=make('button','Block user','button button-primary sathivo-safety-block-confirm');
  cancel.type=yes.type='button';
  cancel.onclick=()=>dialog.close('cancelled');
  yes.onclick=()=>dialog.close('submitted');
  actions.append(cancel,yes);
  body.append(heading,intro,actions);
  dialog.append(body);
  openDialog(dialog,resolve);
 });
}
