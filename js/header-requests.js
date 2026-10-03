import {authConfig} from './auth-config.js?v=20260926-1';
async function ensureSdk(){
 if(globalThis.supabase?.createClient)return;
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='assets/vendor/supabase-2.116.0.js';s.onload=resolve;s.onerror=reject;document.head.append(s)});
}
function createBell(){
 const a=document.createElement('a');a.className='request-bell';a.href='requests.html';a.setAttribute('aria-label','Incoming requests');
 a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="request-badge" hidden>0</span>';
 return a;
}
function placeBell(bell){
 const host=document.querySelector('.site-header .container');if(!host||host.querySelector('.request-bell'))return false;
 if(host.classList.contains('nav-wrap')){const toggle=host.querySelector('.menu-toggle');if(toggle)toggle.before(bell);else host.append(bell)}
 else if(host.classList.contains('directory-nav'))(host.querySelector(':scope > div')||host).append(bell);
 else if(host.classList.contains('profile-nav'))(host.querySelector(':scope > span')||host).append(bell);
 else if(host.classList.contains('marketplace-nav'))(host.querySelector('nav')||host).append(bell);
 else host.append(bell);
 return true;
}
async function init(){
 try{
  await ensureSdk();if(!globalThis.supabase?.createClient)return;
  const client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
  const u=await client.auth.getUser(),user=u.data.user;if(!user)return;
  const bell=createBell();if(!placeBell(bell))return;const badge=bell.querySelector('.request-badge');
  const refresh=async()=>{const {count,error}=await client.from('booking_requests').select('id',{count:'exact',head:true}).eq('companion_id',user.id).eq('status','pending');if(error)return;const n=count||0;badge.textContent=n>99?'99+':String(n);badge.hidden=n===0;bell.setAttribute('aria-label',n?(String(n)+' incoming request'+(n===1?'':'s')):'No pending incoming requests')};
  await refresh();
  const channel=client.channel('header-requests:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void refresh()).subscribe();
  window.addEventListener('pagehide',()=>void client.removeChannel(channel),{once:true});
 }catch{}
}
void init();