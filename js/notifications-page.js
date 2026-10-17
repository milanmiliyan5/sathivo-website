import {getSathivoClient} from './supabase-client.js?v=20261006-1';

const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=text;
 if(className)node.className=className;
 return node;
};
const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const linkPattern=new RegExp('^(?:requests\\.html\\?id=|bookings\\.html\\?id=|chat\\.html\\?booking=)'+uuid+'$','i');
const simpleRoutes=new Set(['requests.html','bookings.html','chats.html']);
let client,user,channel,rows=[],unreadTotal=0,filter='all',seq=0,busy=false;

function safeLink(raw){
 if(typeof raw!=='string')return '';
 const link=raw.trim();
 if(simpleRoutes.has(link)||linkPattern.test(link))return link;
 return '';
}
function notificationType(r){
 const title=String(r.title||'').toLowerCase();
 if(r.kind==='message')return 'message';
 if(title.includes('accepted'))return 'accepted';
 if(title.includes('declined')||title.includes('cancelled'))return 'closed';
 return 'booking';
}
function actionText(r){
 if(r.kind==='message'||notificationType(r)==='accepted')return 'Open Private Chat ↗';
 if(String(r.title||'').toLowerCase().includes('request'))return 'View Booking Request ↗';
 return 'View Booking ↗';
}
function friendlyTime(value){
 try{return fmt(value)}catch{return ''}
}
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
async function markOne(id){
 const {error}=await client.from('notifications').update({read_at:new Date().toISOString()})
  .eq('id',id).eq('user_id',user.id).is('read_at',null);
 if(error)throw error;
}
async function openNotification(r,link,button){
 if(busy)return;
 showError('');
 button.setAttribute('aria-busy','true');
 try{
  if(!r.read_at)await markOne(r.id);
  window.location.assign(new URL(link,location.href).href);
 }catch(error){
  showError('Could not mark this notification as read. You can still open it, or try again.');
  button.setAttribute('aria-busy','false');
  // Never block navigation when the read marker is temporarily unavailable.
  const other=el('a','Open without marking read ↗','button button-outline');
  other.href=link;
  const actions=button.parentElement;
  if(actions&&!actions.querySelector('.notify-open-fallback')){other.classList.add('notify-open-fallback');actions.append(other);}
 }
}
function renderCard(r){
 const kind=notificationType(r);
 const card=el('article',undefined,'notify-card is-'+kind+(r.read_at?'':' is-unread'));
 const icon=el('span',kind==='message'?'💬':kind==='accepted'?'✓':kind==='closed'?'↪':'💌','notify-card-icon');
 icon.setAttribute('aria-hidden','true');
 const main=el('div',undefined,'notify-card-body');
 const top=el('div',undefined,'notify-card-top');
 top.append(el('h2',r.title||'Sathivo update','notify-card-title'));
 if(!r.read_at){
  const dot=el('span',undefined,'notify-unread-dot');
  dot.setAttribute('aria-label','Unread');
  dot.setAttribute('title','Unread');
  top.append(dot);
 }
 main.append(top,el('p',r.body||'You have a new update.','notify-card-description'));
 const t=el('time',friendlyTime(r.created_at),'notify-card-date');
 t.dateTime=r.created_at;
 main.append(t);
 const actions=el('div',undefined,'notify-card-actions');
 const link=safeLink(r.link);
 if(link){
  const button=el('a',actionText(r),'button button-primary notify-open');
  button.href=link;
  button.addEventListener('click',e=>{
   if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;
   e.preventDefault();
   void openNotification(r,link,button);
  });
  actions.append(button);
 }
 if(!r.read_at){
  const mark=el('button','Mark as read','notify-mark-single');
  mark.type='button';
  mark.addEventListener('click',async()=>{
   if(busy)return;
   busy=true;mark.disabled=true;showError('');
   try{await markOne(r.id);await load()}catch(error){showError(error.message||'Could not mark as read. Please try again.')}
   finally{busy=false;updateSummary()}
  });
  actions.append(mark);
 }
 if(actions.childElementCount)main.append(actions);
 card.append(icon,main);
 return card;
}
function render(){
 const visible=filter==='unread'?rows.filter(r=>!r.read_at):rows;
 $('notifications').replaceChildren(...visible.map(renderCard));
 const empty=$('empty');
 empty.hidden=visible.length>0;
 if(!visible.length){
  empty.querySelector('h2').textContent=filter==='unread'?'All caught up!':'All quiet for now.';
  empty.querySelector('p').textContent=filter==='unread'?'You have no unread notifications.':'Your booking and message updates will appear here.';
 }
 $('status').textContent=rows.length?rows.length+' recent notification'+(rows.length===1?'':'s')+'.':'';
 updateSummary();
}
async function load(){
 const thisRequest=++seq;
 const [list,count]=await Promise.all([
  client.from('notifications').select('id,kind,title,body,link,created_at,read_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),
  client.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null)
 ]);
 if(thisRequest!==seq)return;
 if(list.error)throw list.error;
 if(count.error)throw count.error;
 rows=list.data||[];
 unreadTotal=count.count||0;
 render();
}
async function markAllRead(){
 if(busy||unreadTotal===0)return;
 busy=true;updateSummary();showError('');
 try{
  const {error}=await client.from('notifications')
   .update({read_at:new Date().toISOString()})
   .eq('user_id',user.id).is('read_at',null);
  if(error)throw error;
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
  channel=client.channel('notifications:'+user.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+user.id},()=>void load().catch(()=>{}))
   .subscribe();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load().catch(()=>{})});
 }catch(error){
  $('status').textContent=error.message||'Could not load notifications.';
 }
}
window.addEventListener('pagehide',()=>{if(channel&&client)void client.removeChannel(channel)});
void init();
