import {getSathivoClient} from './supabase-client.js?v=20261006-1';
const $=id=>document.getElementById(id);
let client,user;
function status(message,tone='info'){const n=$('delete-status');n.textContent=message;n.dataset.tone=tone}
async function init(){
  
  client=await getSathivoClient();
  const res=await client.auth.getUser();user=res.data.user||null;
  if(!user?.email){$('delete-signed-out').hidden=false;status('Sign in to delete your Sathivo account.');return}
  $('delete-email').textContent=user.email;$('delete-form').hidden=false;status('Re-enter your password and confirmations below.');
  $('delete-form').addEventListener('submit',submit);
}
async function submit(event){
  event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
  const typedEmail=$('confirm-email').value.trim().toLowerCase(),password=$('delete-password').value,word=$('delete-word').value.trim();
  if(typedEmail!==user.email.toLowerCase()){status('The email does not match the signed-in account.','error');return}
  if(word!=='DELETE'){status('Type DELETE exactly to confirm.','error');return}
  const button=form.querySelector('button[type=submit]');button.disabled=true;status('Confirming your password…');
  try{
    const login=await client.auth.signInWithPassword({email:user.email,password});
    if(login.error)throw Error('Password confirmation failed.');
    status('Deleting your account and associated data…');
    const {error}=await client.functions.invoke('delete-my-account',{body:{confirmation:'DELETE'}});
    if(error)throw error;
    try{await client.auth.signOut({scope:'local'})}catch{}
    try{localStorage.removeItem('sathivo.auth.v1')}catch{}
    form.hidden=true;status('Your Sathivo account has been permanently deleted.','success');
  }catch(error){status(error?.message||'Could not delete the account. Please try again or contact support.','error');button.disabled=false}
}
void init();