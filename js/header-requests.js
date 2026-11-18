import {createRefreshQueue} from './refresh-queue.js?v=20261118-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
function placeIndicator(){
 const host=document.querySelector('.site-header .container');if(!host)return null;
 let link=host.querySelector('.desktop-header-links a[href="requests.html"],#navigation a[href="requests.html"]');
 if(!link&&host.classList.contains('compact-header')){
  link=document.createElement('a');link.href='requests.html';link.textContent='Requests';
  link.className='desktop-request-indicator';host.append(link);
 }
 if(!link)return null;
 if(document.body.classList.contains('home-2d'))link.classList.add('homepage-requests-link');
 else link.classList.add('desktop-request-indicator');
 if(!link.querySelector('.request-badge')){
  const badge=document.createElement('span');badge.className='request-badge';badge.hidden=true;badge.textContent='0';link.append(badge);
 }
 return link;
}
async function init(){
 try{
  const client=await getSathivoClient();
  const u=await client.auth.getUser(),user=u.data.user;if(!user)return;
  const indicator=placeIndicator();if(!indicator)return;const badge=indicator.querySelector('.request-badge');
  let active=true,channel=null;
  const refresh=async()=>{const {count,error}=await client.from('booking_requests').select('id',{count:'exact',head:true}).eq('companion_id',user.id).eq('status','pending');if(!active||error)return;const n=count||0;badge.textContent=n>99?'99+':String(n);badge.hidden=n===0;indicator.setAttribute('aria-label',n?(String(n)+' incoming request'+(n===1?'':'s')):'Requests, no pending incoming requests')};
  const queued=createRefreshQueue(refresh);
  function start(){
   active=true;
   if(!channel)channel=client.channel('header-requests:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests',filter:'companion_id=eq.'+user.id},queued.request).subscribe(status=>{if(status==='SUBSCRIBED')queued.request()});
   queued.start();
  }
  window.addEventListener('pagehide',()=>{active=false;queued.stop();if(channel){void client.removeChannel(channel);channel=null}});
  window.addEventListener('pageshow',start);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)queued.request()});
  start();
 }catch{}
}
void init();