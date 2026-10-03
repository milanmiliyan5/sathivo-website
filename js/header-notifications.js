import {authConfig} from './auth-config.js?v=20260926-1';
async function ensureSdk(){
 if(globalThis.supabase?.createClient)return;
 const existing=[...document.scripts].find(s=>s.src&&s.src.includes('assets/vendor/supabase-2.116.0.js'));
 if(existing){await new Promise((resolve,reject)=>{if(globalThis.supabase?.createClient){resolve();return}existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true})});return}
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='assets/vendor/supabase-2.116.0.js';s.onload=resolve;s.onerror=reject;document.head.append(s)});
}
function addBadge(link,kind){
 const cls=kind==='chat'?'chat-header-badge':'notification-badge';if(link.querySelector('.'+cls))return link.querySelector('.'+cls);
 link.classList.add('notification-link');const badge=document.createElement('span');badge.className=cls;badge.hidden=true;badge.textContent='0';link.append(badge);return badge;
}
async function init(){
 try{
  await ensureSdk();if(!globalThis.supabase?.createClient)return;
  const client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
  const u=await client.auth.getUser(),user=u.data.user;if(!user)return;
  const notificationBadges=[...document.querySelectorAll('a[href="notifications.html"]')].map(a=>addBadge(a,'notification'));
  const chatBadges=[...document.querySelectorAll('a[href="chats.html"]')].map(a=>addBadge(a,'chat'));
  const refresh=async()=>{
   const [nq,cq]=await Promise.all([
    client.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null),
    client.rpc('get_unread_chat_count')
   ]);
   const nn=nq.error?0:(nq.count||0),cn=cq.error?0:Number(cq.data||0);
   for(const b of notificationBadges){b.textContent=nn>99?'99+':String(nn);b.hidden=nn===0}
   for(const b of chatBadges){b.textContent=cn>99?'99+':String(cn);b.hidden=cn===0}
  };
  await refresh();
  const c1=client.channel('header-notifications:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+user.id},()=>void refresh()).subscribe();
  const c2=client.channel('header-chat-count:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_messages'},()=>void refresh()).subscribe();
  window.addEventListener('pagehide',()=>{void client.removeChannel(c1);void client.removeChannel(c2)},{once:true});
 }catch{}
}
void init();