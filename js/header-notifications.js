import {createRefreshQueue} from './refresh-queue.js?v=20261118-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import './incoming-booking-popup.js?v=20261122-4sec';

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
  // Delayed, once-per-new-listing popup for signed-in users with a saved location.
  void import('./nearby-discovery.js?v=20261123-photo-gender-1').catch(()=>{});
  mobileNotificationShortcut();
  const notificationLinks=[...document.querySelectorAll('a[href="notifications.html"]')]
   .filter(a=>!a.closest('.mobile-bottom-nav'));
  const chatLinks=[...document.querySelectorAll('a[href="chats.html"]')]
   .filter(a=>!a.closest('.mobile-bottom-nav'));
  const notificationBadges=notificationLinks.map(a=>addBadge(a,'notification'));
  const chatBadges=chatLinks.map(a=>addBadge(a,'chat'));
  let active=true,channel=null;
  const noticesRefresh=createRefreshQueue(async()=>{
   const [notices,website]=await Promise.all(['notifications','website_notifications'].map(table=>client.from(table).select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null)));
   if(!active||notices.error)return;
   const n=(notices.count||0)+(website.error?0:website.count||0);
   notificationBadges.forEach(b=>{b.textContent=n>99?'99+':String(n);b.hidden=n===0});
   notificationLinks.forEach(a=>a.setAttribute('aria-label',n?'Notifications, '+n+' unread':'Notifications, all caught up'));
  });
  const chatsRefresh=createRefreshQueue(async()=>{
   const chats=await client.rpc('get_unread_chat_count');
   if(!active||chats.error)return;
   const n=Math.max(0,Number(chats.data)||0);
   chatBadges.forEach(b=>{b.textContent=n>99?'99+':String(n);b.hidden=n===0});
   chatLinks.forEach(a=>a.setAttribute('aria-label',n?'Chats, '+n+' unread messages':'Chats'));
  });
  function start(){
   active=true;
   if(!channel)channel=client.channel('header-counts:'+user.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+user.id},noticesRefresh.request)
    .on('postgres_changes',{event:'*',schema:'public',table:'website_notifications',filter:'user_id=eq.'+user.id},noticesRefresh.request)
    .on('postgres_changes',{event:'*',schema:'public',table:'booking_messages'},chatsRefresh.request)
    .subscribe(status=>{if(status==='SUBSCRIBED'){noticesRefresh.request();chatsRefresh.request()}});
   noticesRefresh.start();chatsRefresh.start();
  }
  function stop(){
   active=false;noticesRefresh.stop();chatsRefresh.stop();
   if(channel){void client.removeChannel(channel);channel=null}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){noticesRefresh.request();chatsRefresh.request()}});
  window.addEventListener('pageshow',start);
  window.addEventListener('pagehide',stop);
  start();
 }catch{}
}
void init();
