import {authConfig} from './auth-config.js?v=20260926-1';
import {sendMessagePush} from './push-events.js?v=20261004-2';

const $=id=>document.getElementById(id);
let client,user,booking,otherId,messageChannel,bookingChannel,presenceChannel;
let mediaViewer=null,viewerImage=null,viewerBlobUrl=null,viewerIsOnce=false;
let selectedPhotoFile=null,selectedPhotoPreviewUrl=null;
let mySafetyId='STV-PRIVATE',sessionUnreadBoundary=null,otherOnline=false,lastOtherActive=null;
let typingTimer=null,typingSent=false,markTimer=null;
const messageBlobUrls=new Set();

const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
const timeOnly=d=>new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit'}).format(new Date(d));
const dateKey=d=>new Date(d).toLocaleDateString('en-CA');
function dayLabel(d){
 const x=new Date(d),now=new Date(),today=now.toLocaleDateString('en-CA');
 const y=new Date(now);y.setDate(now.getDate()-1);
 const key=x.toLocaleDateString('en-CA');
 if(key===today)return 'Today';
 if(key===y.toLocaleDateString('en-CA'))return 'Yesterday';
 return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(x);
}
function nearBottom(){return window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-180}
function updateJump(){const b=$('jump-latest');if(b)b.hidden=nearBottom()}
function applySafetyWatermark(){
 const main=$('main');if(!main||main.querySelector('.chat-watermark-layer'))return;
 const layer=el('div',undefined,'chat-watermark-layer');
 for(let i=0;i<12;i++)layer.append(el('span','Sathivo · '+mySafetyId));
 main.prepend(layer);
}
function ensureViewer(){
 if(mediaViewer)return mediaViewer;
 mediaViewer=el('div',undefined,'secure-media-viewer');mediaViewer.hidden=true;
 mediaViewer.setAttribute('role','dialog');mediaViewer.setAttribute('aria-modal','true');mediaViewer.setAttribute('aria-label','Private photo viewer');
 const top=el('div',undefined,'secure-media-top'),badge=el('span','🔒 Private photo · '+mySafetyId,'secure-media-badge'),close=el('button','Close ✕','secure-media-close');
 close.type='button';close.onclick=()=>closeViewer();top.append(badge,close);
 const stage=el('div',undefined,'secure-media-stage');viewerImage=document.createElement('img');viewerImage.className='secure-media-image';viewerImage.alt='Private shared photo';viewerImage.draggable=false;
 const marks=el('div',undefined,'secure-watermark');for(let i=0;i<12;i++)marks.append(el('span','Sathivo · '+mySafetyId));
 stage.append(viewerImage,marks);
 const note=el('p','Private media · '+mySafetyId,'secure-media-note');
 mediaViewer.append(top,stage,note);document.body.append(mediaViewer);
 mediaViewer.addEventListener('click',e=>{if(e.target===mediaViewer)closeViewer()});return mediaViewer;
}
function closeViewer(){
 if(!mediaViewer||mediaViewer.hidden)return;
 mediaViewer.classList.add('closing');
 setTimeout(()=>{mediaViewer.hidden=true;mediaViewer.classList.remove('closing')},120);
 if(viewerImage)viewerImage.removeAttribute('src');
 if(viewerBlobUrl){URL.revokeObjectURL(viewerBlobUrl);viewerBlobUrl=null}
 const wasOnce=viewerIsOnce;viewerIsOnce=false;document.body.classList.remove('media-open');if(wasOnce)void loadMessages(false);
}
async function showNormalPhoto(url){const v=ensureViewer();viewerIsOnce=false;viewerImage.src=url;v.hidden=false;document.body.classList.add('media-open')}
async function openViewOnce(r){
 if(r.viewed_at){$('status').textContent='This view-once photo has already been opened.';return}
 $('status').textContent='Opening view-once photo…';
 try{
  const {data,error}=await client.functions.invoke('open-view-once-photo',{body:{message_id:r.id}});
  if(error||!data?.signed_url)throw error||new Error('Photo unavailable');
  const response=await fetch(data.signed_url,{cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('Could not load private photo');
  const blob=await response.blob();viewerBlobUrl=URL.createObjectURL(blob);
  const v=ensureViewer();viewerIsOnce=true;viewerImage.src=viewerBlobUrl;v.hidden=false;document.body.classList.add('media-open');$('status').textContent='';
 }catch{$('status').textContent='This view-once photo is already opened or unavailable.';void loadMessages(false)}
}
async function normalImageFrame(r){
 const frame=el('button',undefined,'chat-photo-frame chat-photo-button');frame.type='button';frame.setAttribute('aria-label','Open photo full screen');
 try{
  const {data,error}=await client.storage.from('booking-chat-photos').download(r.photo_path);if(error||!data)throw error||Error('Photo unavailable');
  const url=URL.createObjectURL(data);messageBlobUrls.add(url);
  const img=document.createElement('img');img.className='chat-photo';img.alt='Shared booking photo';img.loading='lazy';img.draggable=false;img.src=url;
  frame.append(img);frame.onclick=()=>void showNormalPhoto(url);
 }catch{frame.append(el('span','Photo unavailable.','chat-photo-loading'));frame.disabled=true}
 return frame;
}
function deliveryLabel(r){if(r.seen_at)return 'Seen';if(r.delivered_at)return 'Delivered';return 'Sent'}
async function messageNode(r){
 const mine=r.sender_id===user.id,n=el('article',undefined,'message'+(mine?' mine':''));
 n.dataset.messageId=r.id;
 if(r.message_type==='image'&&r.photo_path){
  if(r.view_once){
   const card=el('div',undefined,'view-once-card');card.append(el('span','①','view-once-icon'));
   const copy=el('div');copy.append(el('strong','View once photo'));
   if(mine){
    if(r.viewed_at){copy.append(el('small','Opened · cannot be viewed again'));card.append(copy,el('span','Opened','view-once-state'))}
    else{copy.append(el('small','Sent · recipient can open once'));card.append(copy,el('span','Sent','view-once-state'))}
   }else if(r.viewed_at){copy.append(el('small','Opened · cannot be viewed again'));card.append(copy,el('span','Opened','view-once-state'))}
   else{copy.append(el('small','Opens once in full screen'));const b=el('button','View photo once','view-once-action');b.type='button';b.onclick=()=>void openViewOnce(r);card.append(copy,b)}
   n.append(card);
  }else n.append(await normalImageFrame(r));
  if(r.body)n.append(el('p',r.body,'message-caption'));
 }else n.append(el('p',r.body,'message-text'));
 const meta=el('div',undefined,'message-meta');meta.append(el('time',timeOnly(r.created_at)));
 if(mine)meta.append(el('span',deliveryLabel(r),'delivery-state'+(r.seen_at?' seen':'')));
 n.append(meta);return n;
}
async function renderMessages(rows,initial=false){
 const wasNear=nearBottom()||initial||!$('messages').dataset.ready;
 for(const url of messageBlobUrls)URL.revokeObjectURL(url);messageBlobUrls.clear();
 const nodes=[];let lastDay='';
 for(const r of rows){
  const key=dateKey(r.created_at);
  if(key!==lastDay){nodes.push(el('div',dayLabel(r.created_at),'date-separator'));lastDay=key}
  if(sessionUnreadBoundary&&r.id===sessionUnreadBoundary)nodes.push(el('div','New messages','unread-divider'));
  nodes.push(await messageNode(r));
 }
 $('messages').replaceChildren(...nodes);$('messages').dataset.ready='true';
 if(wasNear)setTimeout(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:initial?'auto':'smooth'}),20);
 updateJump();
}
async function markChatState(seen){
 clearTimeout(markTimer);markTimer=setTimeout(async()=>{
  try{await client.functions.invoke('mark-chat-read',{body:{booking_id:booking.id,seen:seen===true}})}catch{}
 },80);
}
async function loadMessages(initial=false){
 const {data,error}=await client.from('booking_messages').select('*').eq('booking_id',booking.id).order('created_at');if(error)throw error;
 const rows=data||[];
 if(!sessionUnreadBoundary){const first=rows.find(r=>r.sender_id!==user.id&&!r.seen_at);if(first)sessionUnreadBoundary=first.id}
 await renderMessages(rows,initial);
 await markChatState(document.visibilityState==='visible');
}
function syncComposer(){
 const open=booking?.status==='accepted';$('message-form').hidden=!open;
 if(open)$('status').textContent='';else if(booking?.status==='pending')$('status').textContent='Chat and photo sharing will open after the companion accepts this request.';else $('status').textContent='This booking is '+booking.status+'. Chat history is read-only.';
}
async function loadBooking(){
 const {data,error}=await client.from('booking_requests').select('*').eq('id',booking.id).single();if(error)throw error;
 booking=data;otherId=user.id===booking.customer_id?booking.companion_id:booking.customer_id;
 const other=user.id===booking.customer_id?booking.companion_display_name:booking.customer_display_name;
 $('chat-title').textContent=other||'Sathivo chat';$('booking-summary').textContent=booking.category+' · '+fmt(booking.requested_for)+' · '+booking.status;const deal=$('deal-summary');if(booking.agreed_hourly_rate){const total=Math.round(Number(booking.agreed_hourly_rate)*Number(booking.duration_minutes)/60);deal.textContent='Agreed rate: ₹'+Number(booking.agreed_hourly_rate).toLocaleString('en-IN')+'/hour · Approx. ₹'+total.toLocaleString('en-IN')+' for '+booking.duration_minutes+' minutes. Coordinate the plan here. Payment is made directly between you outside Sathivo; never share a UPI PIN or OTP.';deal.hidden=false}else deal.hidden=true;syncComposer();
}
function presenceText(){
 const p=$('presence-status');if(!p)return;
 if(p.dataset.typing==='true'){p.textContent='Typing…';p.className='presence-status typing';return}
 if(otherOnline){p.textContent='Online';p.className='presence-status online';return}
 p.textContent=lastOtherActive?'Active recently':'Private booking chat';p.className='presence-status';
}
function setupPresence(){
 presenceChannel=client.channel('chat-live:'+booking.id,{config:{presence:{key:user.id},broadcast:{self:false}}})
  .on('presence',{event:'sync'},()=>{
    const state=presenceChannel.presenceState();otherOnline=Array.isArray(state[otherId])&&state[otherId].length>0;if(otherOnline)lastOtherActive=new Date();presenceText();
  })
  .on('broadcast',{event:'typing'},({payload})=>{
    if(payload?.user_id!==otherId)return;const p=$('presence-status');p.dataset.typing=payload.typing?'true':'false';presenceText();
    if(payload.typing){clearTimeout(p._typingTimer);p._typingTimer=setTimeout(()=>{p.dataset.typing='false';presenceText()},1600)}
  })
  .subscribe(async status=>{if(status==='SUBSCRIBED')await presenceChannel.track({user_id:user.id,online_at:new Date().toISOString()})});
}
function sendTyping(){
 if(!presenceChannel)return;
 if(!typingSent){typingSent=true;void presenceChannel.send({type:'broadcast',event:'typing',payload:{user_id:user.id,typing:true}})}
 clearTimeout(typingTimer);typingTimer=setTimeout(()=>{typingSent=false;void presenceChannel?.send({type:'broadcast',event:'typing',payload:{user_id:user.id,typing:false}})},1100);
}
function clearPhotoDraft(){
 selectedPhotoFile=null;if(selectedPhotoPreviewUrl){URL.revokeObjectURL(selectedPhotoPreviewUrl);selectedPhotoPreviewUrl=null}
 if($('photo-input'))$('photo-input').value='';if($('photo-draft'))$('photo-draft').hidden=true;if($('photo-draft-image'))$('photo-draft-image').removeAttribute('src');if($('view-once'))$('view-once').checked=false;
 if($('message')){$('message').maxLength=2000;$('message').placeholder='Write a message…'}if($('photo-status'))$('photo-status').textContent='';
}
function stagePhoto(file){
 const ps=$('photo-status'),types=['image/jpeg','image/png','image/webp'];if(!types.includes(file.type)){clearPhotoDraft();ps.textContent='Please choose a JPG, PNG or WebP image.';return}
 if(file.size>5*1024*1024){clearPhotoDraft();ps.textContent='Photo must be 5 MB or smaller.';return}
 clearPhotoDraft();selectedPhotoFile=file;selectedPhotoPreviewUrl=URL.createObjectURL(file);$('photo-draft-image').src=selectedPhotoPreviewUrl;$('photo-draft').hidden=false;$('message').maxLength=1000;$('message').placeholder='Add a caption…';ps.textContent='Photo ready. Add a caption, choose View once if you want, then tap Send.';
}
async function prepareChatPhoto(file){
 try{
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));if(blob&&blob.size<file.size)return {blob,ext:'webp',type:'image/webp'};
 }catch{}
 return {blob:file,ext:{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],type:file.type};
}
async function sendStagedPhoto(){
 const file=selectedPhotoFile,ps=$('photo-status');if(!file)return false;if(booking.status!=='accepted'){ps.textContent='Photo sharing opens after the request is accepted.';return false}
 const viewOnce=$('view-once')?.checked===true,caption=$('message').value.trim().slice(0,1000);ps.innerHTML='<span class="upload-spinner"></span> Preparing photo…';
 const prepared=await prepareChatPhoto(file);const path=booking.id+'/'+user.id+'/'+crypto.randomUUID()+'.'+prepared.ext;ps.innerHTML='<span class="upload-spinner"></span> Sending photo…';
 const up=await client.storage.from('booking-chat-photos').upload(path,prepared.blob,{contentType:prepared.type,cacheControl:'60',upsert:false});
 if(up.error){ps.textContent='Upload failed. Tap Send to retry.';return false}
 const msg=await client.from('booking_messages').insert({booking_id:booking.id,sender_id:user.id,message_type:'image',photo_path:path,body:caption,view_once:viewOnce}).select('id').single();
 if(msg.error){await client.storage.from('booking-chat-photos').remove([path]);ps.textContent='Send failed. Tap Send to retry.';return false}
 clearPhotoDraft();$('message').value='';$('photo-status').textContent=viewOnce?'View-once photo sent.':'Photo sent.';void sendMessagePush(client,booking.id,msg.data.id);return true;
}
async function report(){const reason=prompt('Reason: safety, harassment, sexual-content, scam, fake-profile, spam, or other');if(!reason)return;const allowed=['safety','harassment','sexual-content','scam','fake-profile','spam','other'];if(!allowed.includes(reason)){alert('Please use one of the listed reasons.');return}const details=prompt('Brief details (optional)')||'';const {error}=await client.from('user_reports').insert({reporter_id:user.id,reported_user_id:otherId,booking_id:booking.id,reason,details});$('status').textContent=error?error.message:'Report submitted for review.'}
async function block(){if(!confirm('Block this user? You will no longer be able to message each other.'))return;const {error}=await client.from('user_blocks').insert({blocker_id:user.id,blocked_id:otherId});$('status').textContent=error?(error.code==='23505'?'User is already blocked.':error.message):'User blocked.';if(!error)$('message-form').hidden=true}
function protectPrivateMedia(){
 document.addEventListener('contextmenu',e=>{if(e.target.closest?.('.messages,.secure-media-viewer'))e.preventDefault()});document.addEventListener('dragstart',e=>{if(e.target.closest?.('.messages,.secure-media-viewer'))e.preventDefault()});
 document.addEventListener('keydown',e=>{if(e.key==='PrintScreen'&&mediaViewer&&!mediaViewer.hidden)closeViewer();if(e.key==='Escape'&&mediaViewer&&!mediaViewer.hidden)closeViewer()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&mediaViewer&&!mediaViewer.hidden)closeViewer();if(!document.hidden)void markChatState(true)});
 window.addEventListener('blur',()=>{if(viewerIsOnce&&mediaViewer&&!mediaViewer.hidden)closeViewer()});
}
async function init(){try{
 if(!globalThis.supabase)throw Error('Services unavailable');const id=new URL(location.href).searchParams.get('booking');if(!/^[0-9a-f-]{36}$/i.test(id||''))throw Error('Invalid booking link.');
 client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
 const u=await client.auth.getUser();user=u.data.user;if(!user){location.replace('account.html#login');return}
 const p=await client.from('member_profiles').select('safety_id').eq('user_id',user.id).maybeSingle();if(p.data?.safety_id)mySafetyId=p.data.safety_id;
 booking={id};await loadBooking();applySafetyWatermark();$('safety-actions').hidden=false;protectPrivateMedia();setupPresence();await loadMessages(true);
 messageChannel=client.channel('booking-messages:'+booking.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_messages',filter:'booking_id=eq.'+booking.id},()=>void loadMessages(false)).subscribe();
 bookingChannel=client.channel('booking-status:'+booking.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'booking_requests',filter:'id=eq.'+booking.id},()=>void loadBooking()).subscribe();
 $('message').addEventListener('input',sendTyping);$('jump-latest').onclick=()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});window.addEventListener('scroll',updateJump,{passive:true});
 $('message-form').onsubmit=async e=>{e.preventDefault();if(booking.status!=='accepted')return;const b=$('send-message');b.disabled=true;try{if(selectedPhotoFile){await sendStagedPhoto();return}const body=$('message').value.trim();if(!body)return;const {data,error}=await client.from('booking_messages').insert({booking_id:booking.id,sender_id:user.id,message_type:'text',body}).select('id').single();if(error){$('status').textContent=error.message;return}$('message').value='';void sendMessagePush(client,booking.id,data.id)}finally{b.disabled=false}};
 $('photo-input').onchange=e=>{const file=e.target.files?.[0];if(file)stagePhoto(file)};$('remove-photo').onclick=()=>clearPhotoDraft();$('report-user').onclick=()=>void report();$('block-user').onclick=()=>void block();
 }catch(e){$('status').textContent=e.message||'Could not load chat.'}}
window.addEventListener('pagehide',()=>{closeViewer();clearPhotoDraft();clearTimeout(typingTimer);clearTimeout(markTimer);for(const url of messageBlobUrls)URL.revokeObjectURL(url);messageBlobUrls.clear();if(messageChannel)void client.removeChannel(messageChannel);if(bookingChannel)void client.removeChannel(bookingChannel);if(presenceChannel)void client.removeChannel(presenceChannel)});
void init();