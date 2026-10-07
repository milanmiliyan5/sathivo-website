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
function status(message,tone='info'){const n=$('support-status');n.textContent=message;n.dataset.tone=tone}
async function init(){
  
  client=await getSathivoClient();
  const u=await client.auth.getUser();
  if(u.data.user?.email)$('support-email').value=u.data.user.email;
  $('support-form').addEventListener('submit',submit);
}
async function submit(event){
  event.preventDefault();
  const form=event.currentTarget;if(!form.reportValidity())return;
  const button=form.querySelector('button[type=submit]');button.disabled=true;status('Sending your request…');
  try{
    const body=Object.fromEntries(new FormData(form).entries());
    const {data,error}=await client.functions.invoke('submit-support',{body});
    if(error)throw error;
    const ref=String(data?.case_id||'').split('-')[0].toUpperCase();
    status('Request sent'+(ref?' · Reference '+ref:'')+'. Keep this reference for follow-up.','success');
    const email=$('support-email').value,category=$('support-category').value;
    form.reset();$('support-email').value=email;$('support-category').value=category;
  }catch(error){status(await errorMessage(error,'Could not send your request. Please try again.'),'error')}
  finally{button.disabled=false}
}
void init();