import {authConfig} from './auth-config.js?v=20260926-1';
const $=id=>document.getElementById(id);
let client;
function status(message,tone='info'){const n=$('feedback-status');n.textContent=message;n.dataset.tone=tone}
async function init(){
  if(!globalThis.supabase){status('Feedback services could not load. Please try again.','error');return}
  client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
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
    status(error?.context?.body?.error||error?.message||'Could not send feedback. Please try again.','error');
  }finally{button.disabled=false}
}
void init();