import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
const link=document.getElementById('official-support-launcher'),badge=document.getElementById('official-support-unread');
let client,user,channel,stopped=false,loading=false,again=false;
async function refresh(){
 if(stopped||!user)return;if(loading){again=true;return;}loading=true;
 try{const {count,error}=await client.from('official_support_messages').select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('sender','official').is('read_at',null);
 if(!error&&!stopped){badge.hidden=!count;badge.textContent=count>99?'99+':String(count||0);link.setAttribute('aria-label','Sathivo Official support chat'+(count?', '+count+' unread replies':''));}}
 finally{loading=false;if(again){again=false;void refresh();}}
}
async function init(){
 try{client=await getSathivoClient();const {data,error}=await client.auth.getUser();if(error||!data.user||stopped)return;user=data.user;
 link.hidden=false;if(new URLSearchParams(location.search).get('tab')==='completed')link.href='support-chat.html?from=completed';
 await refresh();if(stopped)return;
 channel=client.channel('official-support-launcher:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'official_support_messages',filter:'user_id=eq.'+user.id},()=>void refresh()).subscribe(s=>{if(s==='SUBSCRIBED')void refresh();});
 client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session&&session.user.id!==user.id)){stopped=true;link.hidden=true;if(channel)void client.removeChannel(channel);}});
 }catch{ /* Do not disrupt normal chats. */ }
}
link.addEventListener('click',()=>{link.href='support-chat.html'+(new URLSearchParams(location.search).get('tab')==='completed'?'?from=completed':'');});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
window.addEventListener('pagehide',()=>{stopped=true;if(channel)void client.removeChannel(channel);});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
void init();
