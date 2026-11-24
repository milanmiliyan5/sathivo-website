import {showChatAvatars} from './chat-avatars.js?v=20261123-avatar-square-1';
import {withCurrentBookingNames} from './booking-name-sync.js?v=20261030-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
const $=id=>document.getElementById(id);
let client,user,messageChannel,bookingChannel;
let chatRows=[],hasLoaded=false,loadSequence=0,disposed=false,refreshTimer=null;
let activeTab=new URLSearchParams(location.search).get('tab')==='completed'?'completed':'ongoing';
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
const fmt=d=>d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d)):'';
function initials(name){return String(name||'S').trim().slice(0,1).toUpperCase()}
function card(r){
 const a=el('a',undefined,'chat-list-card');a.href='chat.html?booking='+encodeURIComponent(r.booking_id);
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
 const cards=rows.map(card);
 $('chats').replaceChildren(...cards);
 if(rows.length)void showChatAvatars(client,rows.map((row,i)=>({userId:row.other_user_id,element:cards[i].querySelector('.chat-list-avatar')})));
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
 const seq=++loadSequence;
 $('chats-retry').hidden=true;
 if(!hasLoaded){$('empty').hidden=true;$('chats').replaceChildren(...skeletons());$('status').textContent='Loading chats…';}
 try{
  const {data,error}=await client.rpc('get_chat_list');if(error)throw error;
  const rows=await withCurrentBookingNames(client,data||[]);
  if(disposed||seq!==loadSequence)return;
  chatRows=rows;hasLoaded=true;
  $('status').textContent='';renderChats();
 }catch(error){
  if(disposed||seq!==loadSequence)return;
  if(!hasLoaded)$('chats').replaceChildren();
  $('status').textContent=hasLoaded?'Could not refresh chats. Please try again.':'Could not load chats. Please try again.';
  $('chats-retry').hidden=false;
 }
}
function scheduleRefresh(){
 if(disposed||!user)return;
 clearTimeout(refreshTimer);
 refreshTimer=setTimeout(()=>void load(),120);
}
$('chats-retry').onclick=()=>{if(user)void load();else void init();};
async function init(){try{
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
 }catch(e){$('status').textContent='Could not connect to chats. Please try again.';$('chats').replaceChildren();$('chats-retry').hidden=false;}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleRefresh();});
window.addEventListener('pagehide',()=>{disposed=true;loadSequence++;clearTimeout(refreshTimer);if(messageChannel)void client.removeChannel(messageChannel);if(bookingChannel)void client.removeChannel(bookingChannel);});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
void init();
