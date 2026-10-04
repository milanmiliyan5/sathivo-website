import {authConfig} from './auth-config.js?v=20260926-1';
const $=id=>document.getElementById(id);
let client;
function status(message,tone='info'){const n=$('support-status');n.textContent=message;n.dataset.tone=tone}
async function init(){
  if(!globalThis.supabase){status('Support services could not load. Please try again.','error');return}
  client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
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
  }catch(error){status(error?.message||'Could not send your request. Please try again.','error')}
  finally{button.disabled=false}
}
void init();