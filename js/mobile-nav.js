import {authConfig} from './auth-config.js?v=20260926-1';
async function ensureSdk(){
 if(globalThis.supabase?.createClient)return;
 const existing=[...document.scripts].find(s=>s.src&&s.src.includes('assets/vendor/supabase-2.116.0.js'));
 if(existing){await new Promise((resolve,reject)=>{if(globalThis.supabase?.createClient){resolve();return}existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true})});return}
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='assets/vendor/supabase-2.116.0.js';s.onload=resolve;s.onerror=reject;document.head.append(s)});
}
const items=[['Home','./','⌂'],['Explore','companions.html','♡'],['Requests','requests.html','↗'],['Chats','chats.html','◌'],['Account','account.html','◉']];
function badge(n){const b=document.createElement('span');b.className='mobile-nav-badge';b.hidden=!n;b.textContent=n>99?'99+':String(n||0);return b}
async function init(){
 const nav=document.createElement('nav');nav.className='mobile-bottom-nav';nav.setAttribute('aria-label','Mobile navigation');
 const path=location.pathname.split('/').pop()||'index.html',refs={};
 for(const [label,href,icon] of items){
  const a=document.createElement('a');a.href=href;if((href==='./'&&['','index.html'].includes(path))||path===href)a.setAttribute('aria-current','page');
  const i=document.createElement('span');i.className='mobile-nav-icon';i.textContent=icon;const t=document.createElement('small');t.textContent=label;a.append(i,t);
  if(label==='Requests'||label==='Chats'){const b=badge(0);a.append(b);refs[label]=b}nav.append(a);
 }
 document.body.append(nav);
 try{
  await ensureSdk();if(!globalThis.supabase)return;
  const client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
  const u=await client.auth.getUser(),user=u.data.user;if(!user)return;
  const refresh=async()=>{
   const [rq,cq]=await Promise.all([client.from('booking_requests').select('id',{count:'exact',head:true}).eq('companion_id',user.id).eq('status','pending'),client.rpc('get_unread_chat_count')]);
   const rn=rq.error?0:(rq.count||0),cn=cq.error?0:Number(cq.data||0);
   refs.Requests.textContent=rn>99?'99+':String(rn);refs.Requests.hidden=rn===0;refs.Chats.textContent=cn>99?'99+':String(cn);refs.Chats.hidden=cn===0;
  };
  await refresh();
  const c1=client.channel('mobile-nav-bookings:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void refresh()).subscribe();
  const c2=client.channel('mobile-nav-messages:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_messages'},()=>void refresh()).subscribe();
  window.addEventListener('pagehide',()=>{void client.removeChannel(c1);void client.removeChannel(c2)},{once:true});
 }catch{}
}
void init();