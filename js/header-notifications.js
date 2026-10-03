import {authConfig} from './auth-config.js?v=20260926-1';
async function ensureSdk(){
 if(globalThis.supabase?.createClient)return;
 const existing=[...document.scripts].find(s=>s.src&&s.src.includes('assets/vendor/supabase-2.116.0.js'));
 if(existing){await new Promise((resolve,reject)=>{if(globalThis.supabase?.createClient){resolve();return}existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true})});return}
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='assets/vendor/supabase-2.116.0.js';s.onload=resolve;s.onerror=reject;document.head.append(s)});
}
function addBadge(link){
 if(link.querySelector('.notification-badge'))return link.querySelector('.notification-badge');
 link.classList.add('notification-link');
 const badge=document.createElement('span');badge.className='notification-badge';badge.hidden=true;badge.textContent='0';link.append(badge);return badge;
}
async function init(){
 try{
  await ensureSdk();if(!globalThis.supabase?.createClient)return;
  const client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
  const u=await client.auth.getUser(),user=u.data.user;if(!user)return;
  const links=[...document.querySelectorAll('a[href="notifications.html"]')];if(!links.length)return;
  const badges=links.map(addBadge);
  const refresh=async()=>{const {count,error}=await client.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null);if(error)return;const n=count||0;for(const badge of badges){badge.textContent=n>99?'99+':String(n);badge.hidden=n===0}};
  await refresh();
  const channel=client.channel('header-notifications:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+user.id},()=>void refresh()).subscribe();
  window.addEventListener('pagehide',()=>void client.removeChannel(channel),{once:true});
 }catch{}
}
void init();