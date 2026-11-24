import {showChatAvatars} from './chat-avatars.js?v=20261123-avatar-square-1';
import {withCurrentBookingNames} from './booking-name-sync.js?v=20261030-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
const $=id=>document.getElementById(id);
let client,user,messageChannel,bookingChannel;
let chatRows=[],hasLoaded=false,loadSequence=0,disposed=false,refreshTimer=null,loading=false,refreshPending=false,initializing=false;
const avatarCheckedAt=new WeakMap();
let activeTab=new URLSearchParams(location.search).get('tab')==='completed'?'completed':'ongoing';
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
const fmt=d=>{const date=new Date(d);return d&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(date):''};
function initials(name){return String(name||'S').trim().slice(0,1).toUpperCase()}
function card(r){
 const a=el('a',undefined,'chat-list-card');a.href='chat.html?booking='+encodeURIComponent(r.booking_id);a.dataset.bookingId=r.booking_id;a.dataset.contactId=String(r.other_user_id||'');a.dataset.rowSignature=rowSignature(r);
 const avatar=el('span',initials(r.other_display_name),'chat-list-avatar');
 const main=el('div',undefined,'chat-list-main'),top=el('div',undefined,'chat-list-top');
 top.append(el('strong',r.other_display_name||'Sathivo member'));
 if(r.last_message_at){
  const time=el('time',fmt(r.last_message_at));
  time.dateTime=r.last_message_at;
  top.append(time);
 }
 const preview=el('p',r.last_message||(r.last_message_type==='image'?'Photo':'No messages yet'),'chat-list-preview');
 if(r.last_message_type==='image')preview.classList.add('photo-preview');
 main.append(top,preview,el('small',r.category+' · '+(r.booking_status==='completed'?'Booking completed':r.booking_status),'chat-list-meta'+(r.booking_status==='completed'?' completed-chat-meta':'')));
 a.append(avatar,main);
 const unread=Number(r.unread_count||0);if(unread>0){const b=el('span',unread>99?'99+':String(unread),'chat-unread-count');a.append(b)}
 return a;
}
// Include every field used in the card, so identical realtime results are a no-op.
function rowSignature(r){
 return JSON.stringify([r.booking_id,r.other_user_id,r.other_display_name,r.last_message_at,r.last_message,r.last_message_type,r.category,r.booking_status,Number(r.unread_count||0)]);
}
function reconcileCards(rows){
 const list=$('chats');
 const existing=new Map([...list.children].filter(n=>n.dataset.bookingId).map(n=>[n.dataset.bookingId,n]));
 const desired=[],contacts=[];
 for(const row of rows){
  let node=existing.get(row.booking_id);
  if(!node){node=card(row);}
  else if(node.dataset.rowSignature!==rowSignature(row)){
   const fresh=card(row);
   if(node.dataset.contactId===fresh.dataset.contactId){
    // Retain the current DP node and the link itself (including keyboard focus).
    const avatar=node.querySelector('.chat-list-avatar');
    const initial=initials(row.other_display_name);
    avatar.dataset.avatarInitial=initial;
    if(!avatar.querySelector('img'))avatar.textContent=initial;
    node.querySelector('.chat-list-main').replaceWith(fresh.querySelector('.chat-list-main'));
    node.querySelector('.chat-unread-count')?.remove();
    const unread=fresh.querySelector('.chat-unread-count');if(unread)node.append(unread);
    node.dataset.rowSignature=fresh.dataset.rowSignature;
   }else{node.replaceWith(fresh);node=fresh;}
  }
  const avatar=node.querySelector('.chat-list-avatar');
  if(row.other_user_id&&(!avatarCheckedAt.has(avatar)||Date.now()-avatarCheckedAt.get(avatar)>=60000)){
   avatarCheckedAt.set(avatar,Date.now());contacts.push({userId:row.other_user_id,element:avatar});
  }
  desired.push(node);
 }
 // Remove only obsolete cards/skeletons; never detach unchanged visible rows.
 const keep=new Set(desired);
 for(const child of [...list.children])if(!keep.has(child))child.remove();
 for(let index=0;index<desired.length;index++){
  if(list.children[index]!==desired[index])list.insertBefore(desired[index],list.children[index]||null);
 }
 if(contacts.length)void showChatAvatars(client,contacts);
}
function skeletons(){
 return Array.from({length:4},()=>{const n=el('div',undefined,'chat-list-card skeleton-card');n.innerHTML='<span class="skeleton-dot"></span><div class="skeleton-lines"><i></i><i></i><i></i></div>';return n});
}
// Group only the participant-scoped records returned by the existing RPC.
// Preserve the server's latest-message order; one conversation per booking.
function splitChats(rows){
 const result={ongoing:[],completed:[]},seen=new Set();
 for(const row of rows){
  if(!row?.booking_id||seen.has(row.booking_id))continue;
  const key=row.booking_status==='accepted'?'ongoing':row.booking_status==='completed'?'completed':null;
  if(!key)continue;
  seen.add(row.booking_id);result[key].push(row);
 }
 return result;
}
function syncTabs(){
 for(const tab of document.querySelectorAll('[data-chat-tab]')){
  const selected=tab.dataset.chatTab===activeTab;
  tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
 }
 $('chats-tab-panel').setAttribute('aria-labelledby','chats-tab-'+activeTab);
}
function renderChats(){
 syncTabs();
 if(!hasLoaded)return;
 const groups=splitChats(chatRows),rows=groups[activeTab];
 $('ongoing-chat-count').textContent=String(groups.ongoing.length);
 $('completed-chat-count').textContent=String(groups.completed.length);
 reconcileCards(rows);
 $('empty').hidden=rows.length>0;
 $('empty').dataset.emptyKind=activeTab==='completed'?'check':'chat';
 $('chats-empty-title').textContent=activeTab==='completed'?'No completed chats':'No ongoing chats';
 $('chats-empty-copy').textContent=activeTab==='completed'?'Your completed conversations will appear here.':'Your accepted bookings will appear here.';
 $('chats-empty-explore').hidden=activeTab==='completed';
}
function selectTab(tab,{write=true,focus=false}={}){
 if(!['ongoing','completed'].includes(tab))return;
 const changed=tab!==activeTab;activeTab=tab;
 if(write&&changed){
  const url=new URL(location.href);
  if(tab==='completed')url.searchParams.set('tab','completed');else url.searchParams.delete('tab');
  history.replaceState(history.state,'',url.href);
 }
 if(changed||!hasLoaded)renderChats();
 if(focus)$('chats-tab-'+tab).focus();
}
for(const tab of document.querySelectorAll('[data-chat-tab]')){
 tab.addEventListener('click',()=>selectTab(tab.dataset.chatTab));
 tab.addEventListener('keydown',event=>{
  const target=event.key==='Home'?'ongoing':event.key==='End'?'completed':['ArrowLeft','ArrowRight'].includes(event.key)?(activeTab==='ongoing'?'completed':'ongoing'):null;
  if(target){event.preventDefault();selectTab(target,{focus:true});}
 });
}
window.addEventListener('popstate',()=>selectTab(new URLSearchParams(location.search).get('tab')==='completed'?'completed':'ongoing',{write:false}));
syncTabs();
async function load(){
 if(!client||!user||disposed)return;
 if(loading){refreshPending=true;return;}
 loading=true;
 const seq=++loadSequence;
 if(!hasLoaded){
  $('chats-retry').hidden=true;$('empty').hidden=true;
  if(!$('chats').querySelector('.skeleton-card'))$('chats').replaceChildren(...skeletons());
  $('status').textContent='Loading chats…';
 }
 try{
  const {data,error}=await client.rpc('get_chat_list');if(error)throw error;
  const rows=await withCurrentBookingNames(client,data||[]);
  if(disposed||seq!==loadSequence)return;
  chatRows=rows;hasLoaded=true;
  renderChats();$('status').textContent='';$('chats-retry').hidden=true;
 }catch(error){
  if(disposed||seq!==loadSequence)return;
  if(!hasLoaded)$('chats').replaceChildren();
  $('status').textContent=hasLoaded?'Could not refresh chats. Please try again.':'Could not load chats. Please try again.';
  $('chats-retry').hidden=false;
 }finally{
  loading=false;
  if(refreshPending&&!disposed){refreshPending=false;scheduleRefresh();}
 }
}
function scheduleRefresh(){
 if(disposed||!user)return;
 clearTimeout(refreshTimer);
 refreshTimer=setTimeout(()=>void load(),120);
}
$('chats-retry').onclick=()=>{if(user)void load();else void init();};
async function init(){if(initializing||disposed)return;initializing=true;try{
 client=await getSathivoClient();
 const u=await client.auth.getUser();
 user=u.data?.user||null;
 if(!user&&(!u.error||u.error.name==='AuthSessionMissingError'||u.error.status===401)){location.replace('account.html#login');return}
 if(u.error)throw u.error;
 if(disposed)return;
 await load();
 if(disposed)return;
 messageChannel=client.channel('chats-inbox-messages:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_messages'},scheduleRefresh).subscribe(status=>{if(status==='SUBSCRIBED')scheduleRefresh();});
 bookingChannel=client.channel('chats-inbox-bookings:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},scheduleRefresh).subscribe(status=>{if(status==='SUBSCRIBED')scheduleRefresh();});
 }catch(e){$('status').textContent='Could not connect to chats. Please try again.';if(!hasLoaded)$('chats').replaceChildren();$('chats-retry').hidden=false;}finally{initializing=false;}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleRefresh();});
window.addEventListener('pagehide',()=>{disposed=true;loadSequence++;clearTimeout(refreshTimer);if(messageChannel)void client.removeChannel(messageChannel);if(bookingChannel)void client.removeChannel(bookingChannel);});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
void init();
