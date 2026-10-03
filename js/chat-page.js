import {authConfig} from './auth-config.js?v=20260926-1';
import {sendMessagePush} from './push-events.js?v=20261004-2';

const $=id=>document.getElementById(id);
let client,user,booking,otherId,messageChannel,bookingChannel;
let mediaViewer=null,viewerImage=null,viewerBlobUrl=null,viewerIsOnce=false;
let selectedPhotoFile=null,selectedPhotoPreviewUrl=null;
const messageBlobUrls=new Set();

const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));

function viewerName(){
 return user?.id===booking?.customer_id
   ? (booking.customer_display_name||'Sathivo member')
   : (booking?.companion_display_name||'Sathivo member');
}
function ensureViewer(){
 if(mediaViewer)return mediaViewer;
 mediaViewer=el('div',undefined,'secure-media-viewer');
 mediaViewer.hidden=true;
 mediaViewer.setAttribute('role','dialog');
 mediaViewer.setAttribute('aria-modal','true');
 mediaViewer.setAttribute('aria-label','Private photo viewer');

 const top=el('div',undefined,'secure-media-top');
 const badge=el('span','🔒 Private photo','secure-media-badge');
 const close=el('button','Close ✕','secure-media-close');close.type='button';close.onclick=()=>closeViewer();
 top.append(badge,close);

 const stage=el('div',undefined,'secure-media-stage');
 viewerImage=document.createElement('img');
 viewerImage.className='secure-media-image';viewerImage.alt='Private shared photo';viewerImage.draggable=false;
 const marks=el('div',undefined,'secure-watermark');
 for(let i=0;i<9;i++)marks.append(el('span','Sathivo private · '+viewerName()));
 stage.append(viewerImage,marks);

 const note=el('p','Private media. View-once photos cannot be reopened after they are opened. Screenshots cannot be technically prevented by a website.','secure-media-note');
 mediaViewer.append(top,stage,note);
 document.body.append(mediaViewer);
 mediaViewer.addEventListener('click',e=>{if(e.target===mediaViewer)closeViewer()});
 return mediaViewer;
}
function closeViewer(){
 if(!mediaViewer||mediaViewer.hidden)return;
 mediaViewer.hidden=true;
 if(viewerImage)viewerImage.removeAttribute('src');
 if(viewerBlobUrl){URL.revokeObjectURL(viewerBlobUrl);viewerBlobUrl=null}
 const wasOnce=viewerIsOnce;viewerIsOnce=false;
 document.body.classList.remove('media-open');
 if(wasOnce)void loadMessages();
}
async function showNormalPhoto(url){
 const viewer=ensureViewer();viewerIsOnce=false;viewerImage.src=url;viewer.hidden=false;document.body.classList.add('media-open');
}
async function openViewOnce(r){
 if(r.viewed_at){$('status').textContent='This view-once photo has already been opened.';return}
 $('status').textContent='Opening view-once photo…';
 try{
  const {data,error}=await client.functions.invoke('open-view-once-photo',{body:{message_id:r.id}});
  if(error||!data?.signed_url)throw error||new Error('Photo unavailable');
  const response=await fetch(data.signed_url,{cache:'no-store',credentials:'omit'});
  if(!response.ok)throw new Error('Could not load private photo');
  const blob=await response.blob();
  viewerBlobUrl=URL.createObjectURL(blob);
  const viewer=ensureViewer();viewerIsOnce=true;viewerImage.src=viewerBlobUrl;viewer.hidden=false;document.body.classList.add('media-open');$('status').textContent='';
 }catch(error){
  $('status').textContent='This view-once photo is already opened or unavailable.';
  void loadMessages();
 }
}
async function normalImageFrame(r){
 const frame=el('button',undefined,'chat-photo-frame chat-photo-button');frame.type='button';frame.setAttribute('aria-label','Open photo full screen');
 try{
  const {data,error}=await client.storage.from('booking-chat-photos').download(r.photo_path);
  if(error||!data)throw error||new Error('Photo unavailable');
  const url=URL.createObjectURL(data);messageBlobUrls.add(url);
  const img=document.createElement('img');img.className='chat-photo';img.alt='Shared booking photo';img.loading='lazy';img.draggable=false;img.src=url;
  frame.append(img);frame.onclick=()=>void showNormalPhoto(url);
 }catch{
  frame.append(el('span','Photo unavailable.','chat-photo-loading'));frame.disabled=true;
 }
 return frame;
}
async function messageNode(r){
 const mine=r.sender_id===user.id,n=el('article',undefined,'message'+(mine?' mine':''));
 if(r.message_type==='image'&&r.photo_path){
  if(r.view_once){
   const card=el('div',undefined,'view-once-card');
   card.append(el('span','◉','view-once-icon'));
   const copy=el('div');copy.append(el('strong','View once photo'));
   if(mine){
    copy.append(el('small',r.viewed_at?'Opened by recipient':'Sent privately'));
    const preview=el('button','Preview','view-once-action');preview.type='button';
    const signed=await client.storage.from('booking-chat-photos').createSignedUrl(r.photo_path,180);
    if(signed.error||!signed.data?.signedUrl)preview.disabled=true;else preview.onclick=()=>void showNormalPhoto(signed.data.signedUrl);
    card.append(copy,preview);
   }else if(r.viewed_at){
    copy.append(el('small','Opened · cannot be viewed again'));card.append(copy,el('span','Opened','view-once-state'));
   }else{
    copy.append(el('small','Opens once in full screen'));
    const open=el('button','View photo once','view-once-action');open.type='button';open.onclick=()=>void openViewOnce(r);card.append(copy,open);
   }
   n.append(card);
  }else n.append(await normalImageFrame(r));
  if(r.body)n.append(el('p',r.body,'message-caption'));
 }else n.append(document.createTextNode(r.body));
 n.append(el('time',fmt(r.created_at)));return n;
}
async function renderMessages(rows){
 const nodes=await Promise.all(rows.map(messageNode));$('messages').replaceChildren(...nodes);
 window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
}
async function loadMessages(){
 const {data,error}=await client.from('booking_messages').select('*').eq('booking_id',booking.id).order('created_at');
 if(error)throw error;await renderMessages(data||[]);
}
function syncComposer(){
 const open=booking?.status==='accepted';$('message-form').hidden=!open;
 if(open)$('status').textContent='';
 else if(booking?.status==='pending')$('status').textContent='Chat and photo sharing will open after the companion accepts this request.';
 else $('status').textContent='This booking is '+booking.status+'. Chat history is read-only.';
}
async function loadBooking(){
 const {data,error}=await client.from('booking_requests').select('*').eq('id',booking.id).single();if(error)throw error;
 booking=data;otherId=user.id===booking.customer_id?booking.companion_id:booking.customer_id;
 const other=user.id===booking.customer_id?booking.companion_display_name:booking.customer_display_name;
 $('chat-title').textContent='Chat with '+(other||'your Sathivo connection');
 $('booking-summary').textContent=booking.category+' · '+fmt(booking.requested_for)+' · '+booking.status;syncComposer();
}
function clearPhotoDraft(){
 selectedPhotoFile=null;
 if(selectedPhotoPreviewUrl){URL.revokeObjectURL(selectedPhotoPreviewUrl);selectedPhotoPreviewUrl=null}
 const input=$('photo-input');if(input)input.value='';
 const draft=$('photo-draft');if(draft)draft.hidden=true;
 const preview=$('photo-draft-image');if(preview)preview.removeAttribute('src');
 const once=$('view-once');if(once)once.checked=false;
 const message=$('message');if(message){message.maxLength=2000;message.placeholder='Write a message…'}
 const ps=$('photo-status');if(ps)ps.textContent='';
}
function stagePhoto(file){
 const ps=$('photo-status'),types=['image/jpeg','image/png','image/webp'];
 if(!types.includes(file.type)){ps.textContent='Please choose a JPG, PNG or WebP image.';clearPhotoDraft();return}
 if(file.size>5*1024*1024){ps.textContent='Photo must be 5 MB or smaller.';clearPhotoDraft();return}
 clearPhotoDraft();selectedPhotoFile=file;selectedPhotoPreviewUrl=URL.createObjectURL(file);
 $('photo-draft-image').src=selectedPhotoPreviewUrl;$('photo-draft').hidden=false;
 $('message').maxLength=1000;$('message').placeholder='Add a caption…';
 ps.textContent='Photo ready. Add a caption, choose View once if you want, then tap Send.';
}
async function sendStagedPhoto(){
 const file=selectedPhotoFile,ps=$('photo-status');if(!file)return false;
 if(booking.status!=='accepted'){ps.textContent='Photo sharing opens after the request is accepted.';return false}
 const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 const viewOnce=$('view-once')?.checked===true,caption=$('message').value.trim().slice(0,1000);
 ps.textContent=viewOnce?'Sending view-once photo…':'Sending photo…';
 const path=booking.id+'/'+user.id+'/'+crypto.randomUUID()+'.'+types[file.type];
 const up=await client.storage.from('booking-chat-photos').upload(path,file,{contentType:file.type,cacheControl:'60',upsert:false});
 if(up.error){ps.textContent=up.error.message;return false}
 const msg=await client.from('booking_messages').insert({booking_id:booking.id,sender_id:user.id,message_type:'image',photo_path:path,body:caption,view_once:viewOnce}).select('id').single();
 if(msg.error){await client.storage.from('booking-chat-photos').remove([path]);ps.textContent=msg.error.message;return false}
 clearPhotoDraft();$('message').value='';$('photo-status').textContent=viewOnce?'View-once photo sent.':'Photo sent.';
 void sendMessagePush(client,booking.id,msg.data.id);return true;
}
async function report(){
 const reason=prompt('Reason: safety, harassment, sexual-content, scam, fake-profile, spam, or other');if(!reason)return;
 const allowed=['safety','harassment','sexual-content','scam','fake-profile','spam','other'];
 if(!allowed.includes(reason)){alert('Please use one of the listed reasons.');return}
 const details=prompt('Brief details (optional)')||'';
 const {error}=await client.from('user_reports').insert({reporter_id:user.id,reported_user_id:otherId,booking_id:booking.id,reason,details});
 $('status').textContent=error?error.message:'Report submitted for review.';
}
async function block(){
 if(!confirm('Block this user? You will no longer be able to message each other.'))return;
 const {error}=await client.from('user_blocks').insert({blocker_id:user.id,blocked_id:otherId});
 $('status').textContent=error?(error.code==='23505'?'User is already blocked.':error.message):'User blocked.';
 if(!error)$('message-form').hidden=true;
}
function protectPrivateMedia(){
 document.addEventListener('contextmenu',e=>{if(e.target.closest?.('.messages,.secure-media-viewer'))e.preventDefault()});
 document.addEventListener('dragstart',e=>{if(e.target.closest?.('.messages,.secure-media-viewer'))e.preventDefault()});
 document.addEventListener('keydown',e=>{
  if(e.key==='PrintScreen'&&mediaViewer&&!mediaViewer.hidden){closeViewer();$('status').textContent='Private photo hidden. Note: websites cannot reliably block system screenshots.'}
  if(e.key==='Escape'&&mediaViewer&&!mediaViewer.hidden)closeViewer();
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&mediaViewer&&!mediaViewer.hidden)closeViewer()});
 window.addEventListener('blur',()=>{if(viewerIsOnce&&mediaViewer&&!mediaViewer.hidden)closeViewer()});
}
async function init(){try{
 if(!globalThis.supabase)throw Error('Services unavailable');
 const id=new URL(location.href).searchParams.get('booking');if(!/^[0-9a-f-]{36}$/i.test(id||''))throw Error('Invalid booking link.');
 client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
 const u=await client.auth.getUser();user=u.data.user;if(!user){location.replace('account.html#login');return}
 booking={id};await loadBooking();$('safety-actions').hidden=false;protectPrivateMedia();await loadMessages();
 messageChannel=client.channel('booking-messages:'+booking.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'booking_messages',filter:'booking_id=eq.'+booking.id},()=>void loadMessages()).subscribe();
 bookingChannel=client.channel('booking-status:'+booking.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'booking_requests',filter:'id=eq.'+booking.id},()=>void loadBooking()).subscribe();
 $('message-form').onsubmit=async e=>{e.preventDefault();if(booking.status!=='accepted')return;const sendButton=$('send-message');if(sendButton)sendButton.disabled=true;try{
  if(selectedPhotoFile){await sendStagedPhoto();return}
  const body=$('message').value.trim();if(!body)return;
  const {data,error}=await client.from('booking_messages').insert({booking_id:booking.id,sender_id:user.id,message_type:'text',body}).select('id').single();if(error){$('status').textContent=error.message;return}$('message').value='';void sendMessagePush(client,booking.id,data.id)
 }finally{if(sendButton)sendButton.disabled=false}};
 $('photo-input').onchange=e=>{const file=e.target.files?.[0];if(file)stagePhoto(file)};
 $('remove-photo').onclick=()=>clearPhotoDraft();
 $('report-user').onclick=()=>void report();$('block-user').onclick=()=>void block();
 }catch(e){$('status').textContent=e.message||'Could not load chat.'}}
window.addEventListener('pagehide',()=>{closeViewer();clearPhotoDraft();for(const url of messageBlobUrls)URL.revokeObjectURL(url);messageBlobUrls.clear();if(messageChannel)void client.removeChannel(messageChannel);if(bookingChannel)void client.removeChannel(bookingChannel)});
void init();