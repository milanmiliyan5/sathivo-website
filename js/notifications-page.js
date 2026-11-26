import {importantNotificationQuery,notificationType} from './notification-feed.js?v=20261126-notify-compact-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';

const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=text;
 if(className)node.className=className;
 return node;
};
import {notificationDate,notificationAge} from './notification-time.js?v=20261117-1';
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const linkPattern=new RegExp('^(?:requests\\.html\\?id=|bookings\\.html\\?id=|chat\\.html\\?booking=|companion\\.html\\?id=)'+uuid+'$','i');
const simpleRoutes=new Set(['requests.html','bookings.html','chats.html','support.html','support-chat.html','companions.html','profile.html','account.html']);
let client,user,channel,rows=[],unreadTotal=0,filter='all',seq=0,busy=false,notificationsLoaded=false,websiteNoticesAvailable=true;

function safeLink(raw){
 if(typeof raw!=='string')return '';
 const link=raw.trim();
 if(link==='index.html')return './';
 if(simpleRoutes.has(link)||linkPattern.test(link))return link;
 return '';
}
function updateRelativeTimes(){
 document.querySelectorAll('.notify-card-date[data-created-at]').forEach(t=>{
  const value=t.dataset.createdAt;
  t.textContent=notificationAge(value)||notificationDate(value);
 });
}
let timeTicker;
function updateSummary(){
 const count=$('notify-count');
 count.textContent=unreadTotal>99?'99+':String(unreadTotal);
 $('notify-summary').setAttribute('aria-label',unreadTotal+' unread notifications');
 $('mark-all-read').disabled=busy||unreadTotal===0;
 $('mark-all-read').textContent=busy?'Updating…':'Mark all as read';
 document.querySelectorAll('[data-notify-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.notifyFilter===filter)));
}
function showError(message){
 $('notify-error').textContent=message||'';
}
async function markOne(r){
 const table=r.source==='website_notifications'?'website_notifications':'notifications';
 const {error}=await client.from(table).update({read_at:new Date().toISOString()})
  .eq('id',r.id).eq('user_id',user.id).is('read_at',null);
 if(error)throw error;
}
async function openNotification(r,link,control){
 if(busy||control.getAttribute('aria-busy')==='true')return;
 control.setAttribute('aria-busy','true');showError('');
 try{if(!r.read_at)await markOne(r);}
 catch{showError('Could not mark this notification as read.');}
 finally{control.removeAttribute('aria-busy');window.location.assign(new URL(link,location.href).href);}
}
const iconPaths={
 booking:'<path d="M3 5h18v14H3zM3 13h5l2 3h4l2-3h5"/>',
 accepted:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 closed:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
 nearby:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 message:'<path d="M20 11.5a8 8 0 0 1-8 8H4l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M8 10h8m-8 4h5"/>',
 support:'<path d="M3 13v-2a9 9 0 0 1 18 0v2M3 13h4v6H3zM17 13h4v6h-4zM17 19c0 2-3 3-6 3"/>',
 system:'<path d="m3 10 15-6v16L3 14zM7 15l2 5h3l-2-4M18 8l3 1v6l-3 1"/>'
};
function renderCard(r){
 const kind=notificationType(r),link=safeLink(r.link);
 const card=el('article',undefined,'notify-card is-'+kind+(r.read_at?'':' is-unread'));
 const control=el(link?'a':'button',undefined,'notify-row');
 if(link)control.href=link;else control.type='button';
 const icon=el('span',undefined,'notify-card-icon');icon.setAttribute('aria-hidden','true');
 icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+iconPaths[kind]+'</svg>';
 const main=el('div',undefined,'notify-card-body');
 main.append(el('span',r.title||'Sathivo update','notify-card-title'));
 // Important announcement/reply content stays readable.
 if(r.body&&(kind==='system'||kind==='support'||!link))main.append(el('span',r.body,'notify-card-description'));
 const fullDate=notificationDate(r.created_at);
 if(fullDate){const t=el('time',notificationAge(r.created_at)||fullDate,'notify-card-date');t.dateTime=r.created_at;t.dataset.createdAt=r.created_at;t.title=fullDate;main.append(t);}
 control.append(icon,main);
 if(!r.read_at){const dot=el('span',undefined,'notify-unread-dot');dot.setAttribute('aria-label','Unread');dot.title='Unread';control.append(dot);}
 if(link){
  const arrow=el('span',undefined,'notify-row-chevron');arrow.setAttribute('aria-hidden','true');
  arrow.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 6 6 6-6 6"/></svg>';
  control.append(arrow);
  control.addEventListener('click',event=>{
   if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
   event.preventDefault();void openNotification(r,link,control);
  });
 }else{
  control.disabled=!!r.read_at;
  control.addEventListener('click',async()=>{
   if(busy||r.read_at)return;busy=true;control.disabled=true;showError('');
   try{await markOne(r);await load()}catch{control.disabled=false;showError('Could not mark as read. Please try again.')}
   finally{busy=false;updateSummary()}
  });
 }
 card.append(control);return card;
}
function render(){
 if(!notificationsLoaded)return;
 const visible=filter==='unread'?rows.filter(r=>!r.read_at):rows;
 $('notifications').replaceChildren(...visible.map(renderCard));
 const empty=$('empty');
 empty.hidden=visible.length>0||!websiteNoticesAvailable;
 if(!visible.length){
  empty.dataset.emptyKind=filter==='unread'?'check':'bell';
  empty.querySelector('h2').textContent=filter==='unread'?'You’re all caught up':'No notifications yet';
  empty.querySelector('p').textContent=filter==='unread'?'No unread notifications.':'New updates will appear here.';
 }
 $('status').textContent=!websiteNoticesAvailable?'Some notifications could not be loaded.':'';
 updateSummary();
}
async function load(){
 const thisRequest=++seq;
 const [list,count,webList,webCount]=await Promise.all([
  ...['notifications','website_notifications'].flatMap(table=>[
   importantNotificationQuery(client.from(table).select('id,kind,title,body,link,created_at,read_at').eq('user_id',user.id),table).order('created_at',{ascending:false}).limit(100),
   importantNotificationQuery(client.from(table).select('id',{count:'exact',head:true}).eq('user_id',user.id),table).is('read_at',null)
  ])
 ]);
 if(thisRequest!==seq)return;
 if(list.error)throw list.error;
 if(count.error)throw count.error;
 rows=[...(list.data||[]),...(webList.error?[]:(webList.data||[]).map(r=>({...r,source:'website_notifications'})))].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,100);
 unreadTotal=(count.count||0)+(webCount.error?0:webCount.count||0);
 notificationsLoaded=true;websiteNoticesAvailable=!webList.error&&!webCount.error;
 render();
}
async function markAllRead(){
 if(busy||unreadTotal===0)return;
 busy=true;updateSummary();showError('');
 try{
  const results=await Promise.all(['notifications','website_notifications'].map(table=>importantNotificationQuery(client.from(table)
   .update({read_at:new Date().toISOString()})
   .eq('user_id',user.id),table).is('read_at',null)));
  if(results[0].error||results[1].error)throw results[0].error||results[1].error;
  await load();
 }catch(error){showError(error.message||'Could not update notifications. Please try again.')}
 finally{busy=false;updateSummary()}
}
async function init(){
 try{
  client=await getSathivoClient();
  const response=await client.auth.getUser();
  user=response.data.user;
  if(!user){location.replace('account.html#login');return}
  document.querySelectorAll('[data-notify-filter]').forEach(button=>{
   button.addEventListener('click',()=>{filter=button.dataset.notifyFilter;render()});
  });
  $('mark-all-read').addEventListener('click',()=>void markAllRead());
  await load();
  timeTicker=setInterval(updateRelativeTimes,60000);
  channel=client.channel('notifications:'+user.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+user.id},()=>void load().catch(()=>{}))
   .on('postgres_changes',{event:'*',schema:'public',table:'website_notifications',filter:'user_id=eq.'+user.id},()=>void load().catch(()=>{}))
   .subscribe();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load().catch(()=>{})});
 }catch(error){
  $('status').textContent=error.message||'Could not load notifications.';
 }
}
window.addEventListener('pagehide',()=>{clearInterval(timeTicker);if(channel&&client)void client.removeChannel(channel)});
void init();
