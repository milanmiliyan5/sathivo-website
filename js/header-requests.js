import {createRefreshQueue} from './refresh-queue.js?v=20261118-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
function createBell(){
 const a=document.createElement('a');a.className='request-bell';a.href='requests.html';a.setAttribute('aria-label','Incoming requests');
 a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.8h8.1L20 8.7v10.6a1.7 1.7 0 0 1-1.7 1.7H7a1.7 1.7 0 0 1-1.7-1.7V5.5A1.7 1.7 0 0 1 7 3.8ZM14.7 3.9v5h5M8.6 13h6.8M8.6 16.4h4.6"/></svg><span class="request-badge" hidden>0</span>';
 return a;
}
function placeBell(bell){
 const host=document.querySelector('.site-header .container');if(!host||host.querySelector('.request-bell'))return null;
 // Requests and notifications are distinct destinations. Reuse the
 // existing Requests navigation link rather than adding another bell.
 const requestsLink=host.querySelector('a[href="requests.html"]');
 if(requestsLink){
  requestsLink.classList.add('header-requests-link');
  if(document.body.classList.contains('home-2d'))requestsLink.classList.add('homepage-requests-link');
  if(!requestsLink.querySelector('.request-badge'))requestsLink.append(bell.querySelector('.request-badge'));
  return requestsLink;
 }
 // On headers without a Requests link, the fallback uses a document icon.
 if(host.classList.contains('nav-wrap')){const toggle=host.querySelector('.menu-toggle');if(toggle)toggle.before(bell);else host.append(bell)}
 else if(host.classList.contains('directory-nav'))(host.querySelector(':scope > div')||host).append(bell);
 else if(host.classList.contains('profile-nav'))(host.querySelector(':scope > span')||host).append(bell);
 else if(host.classList.contains('marketplace-nav'))(host.querySelector('nav')||host).append(bell);
 else host.append(bell);
 return bell;
}
async function init(){
 try{
  const client=await getSathivoClient();
  const u=await client.auth.getUser(),user=u.data.user;if(!user)return;
  const indicator=placeBell(createBell());if(!indicator)return;const badge=indicator.querySelector('.request-badge');
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