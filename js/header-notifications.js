import {getSathivoClient} from './supabase-client.js?v=20261006-1';

function addBadge(link,kind){
 const cls=kind==='chat'?'chat-header-badge':'notification-badge';
 const existing=link.querySelector('.'+cls);
 if(existing)return existing;
 link.classList.add('notification-link');
 const badge=document.createElement('span');
 badge.className=cls;
 badge.hidden=true;
 badge.textContent='0';
 link.append(badge);
 return badge;
}
function mobileNotificationShortcut(){
 const host=document.querySelector('.site-header .container');
 if(!host)return;
 const previous=host.querySelector('.notification-shortcut');
 if(previous)return previous;
 const link=document.createElement('a');
 link.href='notifications.html';
 link.className='notification-shortcut';
 link.setAttribute('aria-label','Notifications');
 link.setAttribute('title','Notifications');
 link.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
 const requestBell=host.querySelector('.request-bell');
 const toggle=host.querySelector('.menu-toggle');
 const nav=host.querySelector('nav');
 if(requestBell)requestBell.after(link);
 else if(toggle)toggle.before(link);
 else if(nav)nav.before(link);
 else host.append(link);
 return link;
}
async function init(){
 try{
  const client=await getSathivoClient();
  const u=await client.auth.getUser();
  const user=u.data.user;
  if(!user)return;
  mobileNotificationShortcut();
  const notificationLinks=[...document.querySelectorAll('a[href="notifications.html"]')]
   .filter(a=>!a.closest('.mobile-bottom-nav'));
  const chatLinks=[...document.querySelectorAll('a[href="chats.html"]')]
   .filter(a=>!a.closest('.mobile-bottom-nav'));
  const notificationBadges=notificationLinks.map(a=>addBadge(a,'notification'));
  const chatBadges=chatLinks.map(a=>addBadge(a,'chat'));
  let sequence=0;
  const refresh=async()=>{
   const current=++sequence;
   const [notices,chats]=await Promise.all([
    client.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null),
    client.rpc('get_unread_chat_count')
   ]);
   if(current!==sequence)return;
   if(!notices.error){
    const n=notices.count||0;
    notificationBadges.forEach(b=>{b.textContent=n>99?'99+':String(n);b.hidden=n===0});
    notificationLinks.forEach(a=>a.setAttribute('aria-label',n?'Notifications, '+n+' unread':'Notifications, all caught up'));
   }
   if(!chats.error){
    const count=Math.max(0,Number(chats.data)||0);
    chatBadges.forEach(b=>{b.textContent=count>99?'99+':String(count);b.hidden=count===0});
    chatLinks.forEach(a=>a.setAttribute('aria-label',count?'Chats, '+count+' unread messages':'Chats'));
   }
  };
  await refresh();
  const c1=client.channel('header-notifications:'+user.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+user.id},()=>void refresh())
   .subscribe();
  const c2=client.channel('header-chat-count:'+user.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'booking_messages'},()=>void refresh())
   .subscribe();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
  window.addEventListener('pageshow',()=>void refresh());
  window.addEventListener('pagehide',()=>{void client.removeChannel(c1);void client.removeChannel(c2)},{once:true});
 }catch{}
}
void init();
