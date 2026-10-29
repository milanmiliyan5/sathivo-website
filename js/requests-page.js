import {withCurrentBookingNames} from './booking-name-sync.js?v=20261030-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {sendBookingPush} from './push-events.js?v=20261004-1';
import {sendBookingEmail} from './booking-email-events.js?v=20261017-1';
import {askCancellationReason,cancellationLabel} from './booking-cancel.js?v=20261006-1';
const $=id=>document.getElementById(id);let client,user,rows=[],filter='pending',channel;
const validBookingId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linkedRequestId=(()=>{try{const id=new URL(location.href).searchParams.get('id')||'';return validBookingId.test(id)?id:''}catch{return ''}})();
let linkedRequestChecked=false,linkedRequestFocused=false;
function selectFilter(next){
 filter=next;
 document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===next));
}

const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
function visible(r){if(filter==='all')return true;if(filter==='closed')return ['declined','cancelled','completed'].includes(r.status);return r.status===filter}
function card(r){
 const n=el('article',undefined,'booking-card request-card');n.id='request-'+r.id;
 const top=el('div',undefined,'booking-top'),identity=el('div',undefined,'request-identity'),avatar=el('span',(r.customer_display_name||'S').trim().slice(0,1).toUpperCase(),'request-avatar'),left=el('div');
 left.append(el('h2',r.customer_display_name||'Sathivo member'),el('div',undefined,'booking-meta'));left.lastChild.append(el('span',r.category),el('span',r.meeting_mode==='in-person'?'In person':'Online'),el('span',fmt(r.requested_for)),el('span',r.duration_minutes+' min'));const price=el('div',undefined,'deal-box');if(r.listed_hourly_rate)price.append(el('span','Listed ₹'+Number(r.listed_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.offered_hourly_rate)price.append(el('strong','Customer offer ₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.agreed_hourly_rate)price.append(el('strong','Agreed ₹'+Number(r.agreed_hourly_rate).toLocaleString('en-IN')+'/hr','deal-agreed'));left.append(price);identity.append(avatar,left);top.append(identity,el('span',r.status,'status-pill'));n.append(top);
 if(r.note)n.append(el('p',r.note,'booking-note'));
 const a=el('div',undefined,'booking-actions');
 if(r.status==='pending'){
  const accept=el('button',r.offered_hourly_rate?'Accept ₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr':'Accept request','button button-primary'),decline=el('button','Decline request','button button-outline');
  accept.onclick=()=>{n.classList.add('request-accepting');accept.disabled=decline.disabled=true;void update(r.id,'accepted')};
  decline.onclick=()=>{if(confirm('Decline this booking request?')){accept.disabled=decline.disabled=true;void update(r.id,'declined')}};a.append(accept,decline);
 }else if(r.status==='accepted'){
  const chat=el('a','Open chat & photos ↗','button button-primary');chat.href='chat.html?booking='+encodeURIComponent(r.id);
  const done=el('button','Mark completed','button button-outline');done.onclick=()=>void update(r.id,'completed');const cancel=el('button','Cancel booking','button button-outline');cancel.onclick=()=>void cancelBooking(r);a.append(chat,done,cancel);
 }
 if(a.childNodes.length)n.append(a);if(r.status==='cancelled'&&r.cancel_reason)n.append(el('p','Cancelled · '+cancellationLabel(r.cancel_reason)+(r.cancel_note?' — '+r.cancel_note:''),'cancellation-note'));if(r.status==='accepted'&&r.agreed_hourly_rate)n.append(el('p','Deal recorded at ₹'+Number(r.agreed_hourly_rate).toLocaleString('en-IN')+'/hour. Coordinate details in chat. Payment stays outside Sathivo.','payment-note'));return n;
}
function render(){
 const list=rows.filter(visible);
 $('requests').replaceChildren(...list.map(card));
 $('empty').hidden=list.length>0;
 $('status').textContent=list.length?(String(list.length)+' request'+(list.length===1?'':'s')+' here.'):'';
 if(!linkedRequestId)return;
 const target=document.getElementById('request-'+linkedRequestId);
 if(target){
  target.classList.add('request-highlight','request-email-focus');
  $('status').textContent='Showing the booking linked from your email.';
  if(!linkedRequestFocused){
   linkedRequestFocused=true;
   target.setAttribute('tabindex','-1');
   requestAnimationFrame(()=>{target.scrollIntoView({behavior:'smooth',block:'center'});target.focus({preventScroll:true})});
  }
 }else if(!rows.some(r=>r.id===linkedRequestId)){
  $('status').textContent='This booking was not found in this account. Sign in with the account that received the booking email.';
 }
}
async function load(){
 $('requests').replaceChildren(...Array.from({length:3},()=>{const n=el('article',undefined,'booking-card request-skeleton');n.innerHTML='<div class="request-identity"><span class="skeleton-dot"></span><div class="skeleton-lines"><i></i><i></i></div></div>';return n}));
 const {data,error}=await client.from('booking_requests').select('*').eq('companion_id',user.id).order('created_at',{ascending:false});
 if(error)throw error;
 rows=await withCurrentBookingNames(client,data||[]);
 if(linkedRequestId&&!linkedRequestChecked){
  linkedRequestChecked=true;
  const requested=rows.find(r=>r.id===linkedRequestId);
  // Reopening an old request email after acceptance should open the private chat.
  if(requested?.status==='accepted'){
   location.replace('chat.html?booking='+encodeURIComponent(linkedRequestId));
   return;
  }
  if(requested)selectFilter(requested.status==='pending'?'pending':requested.status==='accepted'?'accepted':'closed');
 }
 $('request-filters').hidden=false;
 render();
}
async function cancelBooking(r){const answer=await askCancellationReason();if(!answer)return;await update(r.id,'cancelled',{cancel_reason:answer.reason,cancel_note:answer.note||null})}
async function update(id,status,extra={}){
 const card=document.getElementById('request-'+id);
 if(card?.dataset.updating==='true')return;
 if(card){card.dataset.updating='true';card.setAttribute('aria-busy','true');card.querySelectorAll('button').forEach(b=>b.disabled=true);}
 $('status').textContent=status==='accepted'?'Accepting request…':'Updating request…';
 try{
  const {error}=await client.from('booking_requests').update({status,...extra}).eq('id',id);
  if(error)throw error;
  $('status').textContent='Sending notification…';
  if(status==='accepted'){
   await Promise.all([sendBookingPush(client,id,status),sendBookingEmail(client,id,'accepted')]);
   location.href='chat.html?booking='+encodeURIComponent(id);return;
  }
  await sendBookingPush(client,id,status);await load();
 }catch{
  $('status').textContent='Could not update this request. Please try again.';
 }finally{
  if(card){delete card.dataset.updating;card.removeAttribute('aria-busy');card.classList.remove('request-accepting');card.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
}
async function markLinkedNotification(){if(!linkedRequestId)return;await client.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).eq('link','requests.html?id='+linkedRequestId).is('read_at',null)}
async function init(){try{
 client=await getSathivoClient();
 const u=await client.auth.getUser();user=u.data.user;if(!user){if(linkedRequestId){const signIn=new URL('account.html',location.href);signIn.searchParams.set('next','requests.html?id='+linkedRequestId);signIn.hash='login';location.replace(signIn.href)}else location.replace('account.html#login');return}
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{selectFilter(b.dataset.filter);render()});
 await markLinkedNotification();await load();
 channel=client.channel('incoming-requests:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void load()).subscribe();
 }catch(e){$('status').textContent=e.message||'Could not load requests.'}}
window.addEventListener('pagehide',()=>{if(channel)void client.removeChannel(channel)});void init();