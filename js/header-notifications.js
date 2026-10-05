import {getSathivoClient} from './supabase-client.js?v=20261006-1';
function addBadge(link,kind){
 const cls=kind==='chat'?'chat-header-badge':'notification-badge';if(link.querySelector('.'+cls))return link.querySelector('.'+cls);
 link.classList.add('notification-link');const badge=document.createElement('span');badge.className=cls;badge.hidden=true;badge.textContent='0';link.append(badge);return badge;
}
async function init(){
 try{
  const client=await getSathivoClient();
  const u=await client.auth.getUser(),user=u.data.user;if(!user)return;
  const notificationBadges=[...document.querySelectorAll('a[href="notifications.html"]')].filter(a=>!a.closest('.mobile-bottom-nav')).map(a=>addBadge(a,'notification'));
  const chatBadges=[...document.querySelectorAll('a[href="chats.html"]')].filter(a=>!a.closest('.mobile-bottom-nav')).map(a=>addBadge(a,'chat'));
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