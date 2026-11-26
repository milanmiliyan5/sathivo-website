import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {$,getMessages,mergeMessages,renderMessages,markRead,sendMessage} from './official-support-common.js?v=20261126-1';
let client,user,channel,rows=[],more=false,loaded=false,busy=false,queued=false,stopped=false,sending=false,retryId=null,retryBody='';
const status=$('official-status'),body=$('official-body'),send=$('official-send'),scroll=$('official-scroll'),container=$('official-messages');
if(new URLSearchParams(location.search).get('from')==='completed')$('official-back').href='chats.html?tab=completed';
function ready(){body.disabled=!loaded||sending;send.disabled=!loaded||sending||!body.value.trim();}
function render({older=false}={}){const prev=scroll.scrollHeight,top=scroll.scrollTop,near=prev-top-scroll.clientHeight<100;
 renderMessages(container,rows,'member');$('official-welcome').hidden=!loaded||rows.length>0;$('official-older').hidden=!more;
 if(older)scroll.scrollTop=top+scroll.scrollHeight-prev;else if(near||!prev)scroll.scrollTop=scroll.scrollHeight;
}
async function refresh(older=false){
 if(!user||stopped)return;if(busy){if(!older)queued=true;return;}busy=true;
 try{const result=await getMessages(client,user.id,older?rows[0]:null);if(stopped)return;
 if(!loaded||older)more=result.more;rows=mergeMessages(rows,result.rows);loaded=true;render({older});
 if(!document.hidden)await markRead(client,result.rows,user.id,'member');
 status.textContent='';$('official-retry').hidden=true;ready();
 }catch{status.textContent='Could not load support chat. Please try again.';$('official-retry').hidden=false;}
 finally{busy=false;if(queued&&!stopped){queued=false;void refresh();}}
}
body.addEventListener('input',()=>{ready();body.style.height='auto';body.style.height=Math.min(112,body.scrollHeight)+'px';});
for(const button of document.querySelectorAll('[data-support-choice]'))button.addEventListener('click',()=>{body.value=button.dataset.supportChoice+': ';body.dispatchEvent(new Event('input'));body.focus();});
$('official-form').addEventListener('submit',async e=>{
 e.preventDefault();if(sending||!loaded||stopped||!body.value.trim())return;sending=true;ready();status.textContent='Sending…';
 const value=body.value.trim();if(retryBody!==value||!retryId){retryId=crypto.randomUUID();retryBody=value;}
 try{await sendMessage(client,user.id,'member',value,retryId);if(stopped)return;body.value='';body.style.height='auto';retryId=null;retryBody='';status.textContent='';await refresh();scroll.scrollTop=scroll.scrollHeight;}
 catch{status.textContent='Message not confirmed. Try Send again in a moment.';}
 finally{sending=false;ready();}
});
$('official-older').addEventListener('click',()=>void refresh(true));
$('official-retry').addEventListener('click',()=>user?void refresh():location.reload());
async function init(){
 try{client=await getSathivoClient();const {data,error}=await client.auth.getUser();if(!data.user&&(!error||error.status===401||error.name==='AuthSessionMissingError')){location.replace('account.html#login');return;}if(error||!data.user)throw Error('Sign in required');user=data.user;if(stopped)return;
 await refresh();scroll.scrollTop=scroll.scrollHeight;if(stopped)return;
 channel=client.channel('official-support-chat:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'official_support_messages',filter:'user_id=eq.'+user.id},()=>{if(!document.hidden)void refresh();}).subscribe(s=>{if(s==='SUBSCRIBED')void refresh();});
 client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session&&session.user.id!==user.id)){stopped=true;container.replaceChildren();location.replace('account.html#login');}});
 }catch{status.textContent='Could not connect to support. Please try again.';$('official-retry').hidden=false;}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
window.addEventListener('pagehide',()=>{stopped=true;if(channel)void client.removeChannel(channel);});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
void init();
