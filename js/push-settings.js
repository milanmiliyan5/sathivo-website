import {authConfig} from './auth-config.js?v=20260926-1';
const VAPID_PUBLIC_KEY='BDDfRYmprtMMmGXd8MfxNCETnK3pOBsSeDf6782GteQGB6l0PLrBGWqbcQFAPpkVCKdkw_aUgtzWVFuJkUeGMus';
let client,currentUser=null;
const boxes=[...document.querySelectorAll('[data-push-settings]')];

function base64UrlToUint8Array(value){
 const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
}
function setUI(message,tone='info',enabled=false){
 boxes.forEach(box=>{
  const status=box.querySelector('[data-push-status]'),button=box.querySelector('[data-push-toggle]');
  if(status){status.textContent=message;status.dataset.tone=tone}
  if(button){button.textContent=enabled?'Turn off device notifications':'Enable device notifications';button.dataset.enabled=String(enabled);button.disabled=false}
 });
}
async function registration(){return navigator.serviceWorker.register('./sw.js',{scope:'./'})}
async function getSubscription(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window))return null;
 const reg=await registration();return (await reg.pushManager.getSubscription())||null;
}
async function registerSubscription(sub){
 if(!currentUser||!sub)return;
 const json=sub.toJSON();
 const {error}=await client.functions.invoke('push-subscription',{body:{action:'register',subscription:json,user_agent:navigator.userAgent}});
 if(error)throw error;
}
async function sync(){
 if(!currentUser){setUI('Sign in to enable device notifications.','info',false);return}
 if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){setUI('Device push notifications are not supported in this browser.','error',false);return}
 if(Notification.permission==='denied'){setUI('Notifications are blocked in your browser settings. Allow Sathivo notifications there first.','error',false);return}
 const sub=await getSubscription();
 if(Notification.permission==='granted'&&sub){await registerSubscription(sub);setUI('Device notifications are on for this browser.','success',true);return}
 setUI('Turn this on to receive booking request, accept, decline and cancel notifications even when Sathivo is in the background.','info',false);
}
async function enable(){
 if(!currentUser){setUI('Sign in first to enable notifications.','error',false);return}
 if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){setUI('Device push notifications are not supported in this browser.','error',false);return}
 let permission=Notification.permission;if(permission==='default')permission=await Notification.requestPermission();
 if(permission!=='granted'){setUI('Notification permission was not allowed. You can enable it later from browser/site settings.','error',false);return}
 setUI('Turning on device notifications…','info',false);
 const reg=await registration();let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(VAPID_PUBLIC_KEY)});
 await registerSubscription(sub);setUI('Device notifications are on for this browser.','success',true);
}
async function disable(){
 try{
  const sub=await getSubscription();
  if(sub&&currentUser)await client.functions.invoke('push-subscription',{body:{action:'unregister',endpoint:sub.endpoint}});
  if(sub)await sub.unsubscribe();
  setUI('Device notifications are off on this browser.','info',false);
 }catch(error){setUI(error.message||'Could not turn off notifications.','error',true)}
}
async function init(){
 if(!boxes.length)return;
 if(!globalThis.supabase){setUI('Notification services are loading…');return}
 client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
 const u=await client.auth.getUser();currentUser=u.data.user||null;
 boxes.forEach(box=>box.querySelector('[data-push-toggle]')?.addEventListener('click',()=>void(box.querySelector('[data-push-toggle]').dataset.enabled==='true'?disable():enable())));
 client.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;void sync()});
 await sync();
 window.sathivoPushUnregister=async()=>{
  try{const sub=await getSubscription();if(!sub||!currentUser)return;if(client)await client.functions.invoke('push-subscription',{body:{action:'unregister',endpoint:sub.endpoint}});await sub.unsubscribe()}catch{}
 };
}
void init();