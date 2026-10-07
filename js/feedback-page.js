import {getSathivoClient} from './supabase-client.js?v=20261006-1';
const $=id=>document.getElementById(id);
let client;
async function errorMessage(error,fallback){
  try{
    const response=error?.context;
    if(response&&typeof response.clone==='function'){
      const payload=await response.clone().json();
      if(payload?.error)return String(payload.error);
    }
  }catch{}
  return error?.message||fallback;
}
function status(message,tone='info'){const n=$('feedback-status');n.textContent=message;n.dataset.tone=tone}
async function init(){
  
  client=await getSathivoClient();
  const u=await client.auth.getUser();
  if(u.data.user?.email)$('feedback-email').value=u.data.user.email;
  $('feedback-form').addEventListener('submit',submit);
}
async function submit(event){
  event.preventDefault();
  const form=event.currentTarget;
  if(!form.reportValidity())return;
  const button=form.querySelector('button[type=submit]');
  button.disabled=true;status('Sending your feedback…');
  try{
    const data=new FormData(form);
    const type=String(data.get('feedback_type')||'').trim();
    const rating=Number(data.get('rating'));
    const labels={suggestion:'Suggestion',bug:'Website bug',experience:'Experience',compliment:'Compliment',other:'Other feedback'};
    const body={
      email:String(data.get('email')||'').trim(),
      category:'feedback',
      feedback_type:type,
      rating,
      subject:(labels[type]||'Feedback')+' · '+rating+'/5',
      message:String(data.get('message')||'').trim(),
      website:String(data.get('website')||'')
    };
    const {data:result,error}=await client.functions.invoke('submit-support',{body});
    if(error)throw error;
    const ref=String(result?.case_id||'').split('-')[0].toUpperCase();
    status('Thank you — feedback sent'+(ref?' · Reference '+ref:'')+'.','success');
    const email=$('feedback-email').value;
    form.reset();$('feedback-email').value=email;
  }catch(error){
    status(await errorMessage(error,'Could not send feedback. Please try again.'),'error');
  }finally{button.disabled=false}
}
void init();