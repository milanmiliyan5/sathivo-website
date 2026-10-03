import {authConfig} from './auth-config.js?v=20260926-1';
const VAPID_PUBLIC_KEY='BDDfRYmprtMMmGXd8MfxNCETnK3pOBsSeDf6782GteQGB6l0PLrBGWqbcQFAPpkVCKdkw_aUgtzWVFuJkUeGMus';
let client,currentUser=null;
async function ensureSdk(){
 if(globalThis.supabase?.createClient)return;
 const existing=[...document.scripts].find(s=>s.src&&s.src.includes('assets/vendor/supabase-2.116.0.js'));
 if(existing){await new Promise((resolve,reject)=>{if(globalThis.supabase?.createClient){resolve();return}existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true})});return}
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='assets/vendor/supabase-2.116.0.js';s.onload=resolve;s.onerror=reject;document.head.append(s)});
}
const boxes=[...document.querySelectorAll('[data-push-settings]')];

function base64UrlToUint8Array(value){
 const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
}
function setUI(message,tone='info',enabled=false){
 boxes.forEach(box=>{
  const status=box.querySelector('[data-push-status]'),button=box.querySelector('[data-push-toggle]'),test=box.querySelector('[data-push-test]');
  if(status){status.textContent=message;status.dataset.tone=tone}
  if(button){button.textContent=enabled?'Turn off device notifications':'Enable device notifications';button.dataset.enabled=String(enabled);button.disabled=false}
  if(test){test.hidden=!enabled;test.disabled=false}
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
async function testPush(){
 try{
  setUI('Sending a test notification…','info',true);
  const {data,error}=await client.functions.invoke('send-booking-push',{body:{event:'test'}});
  if(error)throw error;
  const sent=Number(data?.sent||0);
  if(sent>0)setUI('Test notification sent. Check your browser/Windows notification area.','success',true);
  else setUI('No registered device was found yet. Turn notifications off and on once, then test again.','error',true);
 }catch(error){setUI(error.message||'Test notification failed.','error',true)}
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
 try{await ensureSdk()}catch{setUI('Notification services could not load.','error',false);return}
 if(!globalThis.supabase){setUI('Notification services could not load.','error',false);return}
 client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
 const u=await client.auth.getUser();currentUser=u.data.user||null;
 boxes.forEach(box=>{box.querySelector('[data-push-toggle]')?.addEventListener('click',()=>void(box.querySelector('[data-push-toggle]').dataset.enabled==='true'?disable():enable()));box.querySelector('[data-push-test]')?.addEventListener('click',()=>void testPush())});
 client.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;void sync()});
 await sync();
 window.sathivoPushUnregister=async()=>{
  try{const sub=await getSubscription();if(!sub||!currentUser)return;if(client)await client.functions.invoke('push-subscription',{body:{action:'unregister',endpoint:sub.endpoint}});await sub.unsubscribe()}catch{}
 };
}
void init();