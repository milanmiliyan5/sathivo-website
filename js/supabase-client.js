import {authConfig} from './auth-config.js?v=20260926-1';
import {createAuthFetch} from './auth-transport.js?v=20260926-1';

let sdkPromise=null;
let sharedClient=null;
const reports=new Set();
const rateLimitHandlers=new Set();

const sharedAuthFetch=createAuthFetch({
  supabaseUrl:authConfig.supabaseUrl,
  report:event=>reports.forEach(fn=>{try{fn(event)}catch{}}),
  onSendRateLimit:seconds=>rateLimitHandlers.forEach(fn=>{try{fn(seconds)}catch{}})
});

export function onAuthTransport({report,onSendRateLimit}={}){
  if(typeof report==='function')reports.add(report);
  if(typeof onSendRateLimit==='function')rateLimitHandlers.add(onSendRateLimit);
  return ()=>{
    if(typeof report==='function')reports.delete(report);
    if(typeof onSendRateLimit==='function')rateLimitHandlers.delete(onSendRateLimit);
  };
}

export async function ensureSupabaseSdk(){
  if(globalThis.supabase?.createClient)return globalThis.supabase;
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>s.src&&s.src.includes('assets/vendor/supabase-2.116.0.js'));
    if(existing){
      if(globalThis.supabase?.createClient){resolve(globalThis.supabase);return;}
      existing.addEventListener('load',()=>resolve(globalThis.supabase),{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const s=document.createElement('script');
    s.src=new URL('../assets/vendor/supabase-2.116.0.js',import.meta.url).href;
    s.onload=()=>resolve(globalThis.supabase);
    s.onerror=reject;
    document.head.append(s);
  });
  return sdkPromise;
}

export async function getSathivoClient(){
  if(sharedClient)return sharedClient;
  if(globalThis.__sathivoSupabaseClient){
    sharedClient=globalThis.__sathivoSupabaseClient;
    return sharedClient;
  }
  await ensureSupabaseSdk();
  if(!globalThis.supabase?.createClient)throw Error('Supabase SDK unavailable');
  sharedClient=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{
    global:{fetch:sharedAuthFetch},
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:false,
      storageKey:'sathivo.auth.v1'
    }
  });
  globalThis.__sathivoSupabaseClient=sharedClient;
  return sharedClient;
}
