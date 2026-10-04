import {authConfig} from './auth-config.js?v=20260926-1';

async function ensureSdk(){
  if(globalThis.supabase?.createClient)return;
  const existing=[...document.scripts].find(s=>s.src&&s.src.includes('assets/vendor/supabase-2.116.0.js'));
  if(existing){
    await new Promise((resolve,reject)=>{
      if(globalThis.supabase?.createClient){resolve();return}
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',reject,{once:true});
    });
    return;
  }
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='assets/vendor/supabase-2.116.0.js';
    s.onload=resolve;s.onerror=reject;document.head.append(s);
  });
}

function browserKey(){
  const storageKey='sathivo.presence.browser.v1';
  try{
    let id=localStorage.getItem(storageKey);
    if(!id){id=crypto.randomUUID();localStorage.setItem(storageKey,id)}
    return id;
  }catch{return crypto.randomUUID()}
}

async function init(){
  try{
    await ensureSdk();
    if(!globalThis.supabase?.createClient)return;
    const client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    const channel=client.channel('site-presence-v1',{config:{presence:{key:browserKey()}}});
    const track=async()=>{
      if(document.visibilityState!=='visible')return;
      try{await channel.track({page:location.pathname.split('/').pop()||'index.html',online_at:new Date().toISOString()})}catch{}
    };
    channel.subscribe(status=>{if(status==='SUBSCRIBED')void track()});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible')void track();
      else void channel.untrack();
    });
    window.addEventListener('pagehide',()=>{void channel.untrack();void client.removeChannel(channel)},{once:true});
  }catch{}
}
void init();
