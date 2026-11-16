import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
let checking=false,completedFor=null,dialog=null,activeUser=null,client;
const labels=Object.freeze({male:'Male',female:'Female',other:'Other'});
function closePrompt(){if(dialog){dialog.close();dialog.remove();dialog=null;}}
function element(tag,content,cls){const e=document.createElement(tag);if(content)e.textContent=content;if(cls)e.className=cls;return e;}
async function check(){
 if(checking||dialog||document.hidden||!client||document.querySelector('dialog[open]'))return;
 checking=true;
 try{
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user||completedFor===user.id)return;
  const {data:gender,error:pendingError}=await client.rpc('pending_companion_gender_prompt');
  if(pendingError)return;
  if(!Object.hasOwn(labels,gender)){completedFor=user.id;return;}
  if(document.hidden||document.querySelector('dialog[open]'))return;
  activeUser=user.id;
  const d=element('dialog',null,'gender-consent-popup');dialog=d;
  const title=element('h2','Show your gender?');title.id='gender-consent-title';
  const copy=element('p','Show your saved gender ('+labels[gender]+') next to your name on your public Sathivo profile?');
  const errorText=element('p',null,'gender-consent-error');errorText.setAttribute('role','status');errorText.hidden=true;
  const actions=element('div',null,'gender-consent-actions');
  const no=element('button','No','gender-consent-no'),yes=element('button','Yes','gender-consent-yes');
  yes.type=no.type='button';
  d.setAttribute('aria-labelledby',title.id);
  d.addEventListener('cancel',e=>e.preventDefault());
  async function answer(show){
   no.disabled=yes.disabled=true;errorText.hidden=true;
   try{
    const {data:{user:current},error:authError}=await client.auth.getUser();
    if(authError||current?.id!==user.id){closePrompt();return;}
    const {data,error}=await client.rpc('answer_companion_gender_prompt',{p_show:show,p_expected_gender:gender});
    if(error)throw error;
    if(data!==true){
     const pending=await client.rpc('pending_companion_gender_prompt');
     if(pending.error)throw pending.error;
     if(pending.data){closePrompt();setTimeout(check,0);return;}
    }
    completedFor=user.id;closePrompt();
    if(show&&data===true&&location.pathname.endsWith('/companions.html'))location.reload();
   }catch{errorText.textContent='Could not save your choice. Please try again.';errorText.hidden=false;no.disabled=yes.disabled=false;}
  }
  yes.addEventListener('click',()=>void answer(true));no.addEventListener('click',()=>void answer(false));
  actions.append(no,yes);d.append(title,copy,errorText,actions);document.body.append(d);d.showModal();
 }catch{}finally{checking=false;}
}
async function init(){
 try{client=await getSathivoClient();
  client.auth.onAuthStateChange((event,session)=>{if(activeUser&&activeUser!==session?.user?.id)closePrompt();if(event==='SIGNED_OUT')completedFor=null;setTimeout(check,0);});
  setTimeout(check,500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
  window.addEventListener('focus',()=>void check());
  document.addEventListener('close',()=>setTimeout(check,0),true);
 }catch{}
}
void init();
