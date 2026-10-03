import {authConfig} from './auth-config.js?v=20260926-1';
import {sendMessagePush} from './push-events.js?v=20261004-2';
const $=id=>document.getElementById(id);let client,user,booking,otherId,messageChannel,bookingChannel;
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
async function messageNode(r){
 const n=el('article',undefined,'message'+(r.sender_id===user.id?' mine':''));
 if(r.message_type==='image'&&r.photo_path){
  const frame=el('div',undefined,'chat-photo-frame'),loading=el('span','Loading photo…','chat-photo-loading');frame.append(loading);n.append(frame);
  const {data,error}=await client.storage.from('booking-chat-photos').createSignedUrl(r.photo_path,900);
  if(error||!data?.signedUrl)loading.textContent='Photo unavailable.';
  else{const img=document.createElement('img');img.className='chat-photo';img.alt='Shared booking photo';img.loading='lazy';img.src=data.signedUrl;frame.replaceChildren(img)}
  if(r.body)n.append(el('p',r.body,'message-caption'));
 }else n.append(document.createTextNode(r.body));
 n.append(el('time',fmt(r.created_at)));return n;
}
async function renderMessages(rows){const nodes=await Promise.all(rows.map(messageNode));$('messages').replaceChildren(...nodes);window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})}
async function loadMessages(){const {data,error}=await client.from('booking_messages').select('*').eq('booking_id',booking.id).order('created_at');if(error)throw error;await renderMessages(data||[])}
function syncComposer(){
 const open=booking?.status==='accepted';$('message-form').hidden=!open;
 if(open)$('status').textContent='';
 else if(booking?.status==='pending')$('status').textContent='Chat and photo sharing will open after the companion accepts this request.';
 else $('status').textContent='This booking is '+booking.status+'. Chat history is read-only.';
}
async function loadBooking(){
 const {data,error}=await client.from('booking_requests').select('*').eq('id',booking.id).single();if(error)throw error;booking=data;otherId=user.id===booking.customer_id?booking.companion_id:booking.customer_id;
 const other=user.id===booking.customer_id?booking.companion_display_name:booking.customer_display_name;$('chat-title').textContent='Chat with '+(other||'your Sathivo connection');$('booking-summary').textContent=booking.category+' · '+fmt(booking.requested_for)+' · '+booking.status;syncComposer();
}
async function sendPhoto(file){
 const ps=$('photo-status');if(booking.status!=='accepted'){ps.textContent='Photo sharing opens after the request is accepted.';return}
 const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};if(!types[file.type]){ps.textContent='Please choose a JPG, PNG or WebP image.';return}
 if(file.size>5*1024*1024){ps.textContent='Photo must be 5 MB or smaller.';return}
 ps.textContent='Uploading photo…';const path=booking.id+'/'+user.id+'/'+crypto.randomUUID()+'.'+types[file.type];
 const up=await client.storage.from('booking-chat-photos').upload(path,file,{contentType:file.type,upsert:false});
 if(up.error){ps.textContent=up.error.message;return}
 const msg=await client.from('booking_messages').insert({booking_id:booking.id,sender_id:user.id,message_type:'image',photo_path:path,body:''}).select('id').single();
 if(msg.error){await client.storage.from('booking-chat-photos').remove([path]);ps.textContent=msg.error.message;return}
 ps.textContent='Photo sent.';$('photo-input').value='';void sendMessagePush(client,booking.id,msg.data.id);
}
async function report(){const reason=prompt('Reason: safety, harassment, sexual-content, scam, fake-profile, spam, or other');if(!reason)return;const allowed=['safety','harassment','sexual-content','scam','fake-profile','spam','other'];if(!allowed.includes(reason)){alert('Please use one of the listed reasons.');return}const details=prompt('Brief details (optional)')||'';const {error}=await client.from('user_reports').insert({reporter_id:user.id,reported_user_id:otherId,booking_id:booking.id,reason,details});$('status').textContent=error?error.message:'Report submitted for review.'}
async function block(){if(!confirm('Block this user? You will no longer be able to message each other.'))return;const {error}=await client.from('user_blocks').insert({blocker_id:user.id,blocked_id:otherId});$('status').textContent=error?(error.code==='23505'?'User is already blocked.':error.message):'User blocked.';if(!error)$('message-form').hidden=true}
async function init(){try{
 if(!globalThis.supabase)throw Error('Services unavailable');const id=new URL(location.href).searchParams.get('booking');if(!/^[0-9a-f-]{36}$/i.test(id||''))throw Error('Invalid booking link.');
 client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
 const u=await client.auth.getUser();user=u.data.user;if(!user){location.replace('account.html#login');return}
 booking={id};await loadBooking();$('safety-actions').hidden=false;await loadMessages();
 messageChannel=client.channel('booking-messages:'+booking.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'booking_messages',filter:'booking_id=eq.'+booking.id},()=>void loadMessages()).subscribe();
 bookingChannel=client.channel('booking-status:'+booking.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'booking_requests',filter:'id=eq.'+booking.id},()=>void loadBooking()).subscribe();
 $('message-form').onsubmit=async e=>{e.preventDefault();if(booking.status!=='accepted')return;const body=$('message').value.trim();if(!body)return;const {data,error}=await client.from('booking_messages').insert({booking_id:booking.id,sender_id:user.id,message_type:'text',body}).select('id').single();if(error){$('status').textContent=error.message;return}$('message').value='';void sendMessagePush(client,booking.id,data.id)};
 $('photo-input').onchange=e=>{const file=e.target.files?.[0];if(file)void sendPhoto(file)};
 $('report-user').onclick=()=>void report();$('block-user').onclick=()=>void block();
 }catch(e){$('status').textContent=e.message||'Could not load chat.'}}
window.addEventListener('pagehide',()=>{if(messageChannel)void client.removeChannel(messageChannel);if(bookingChannel)void client.removeChannel(bookingChannel)});void init();