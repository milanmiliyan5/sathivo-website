import {showCompletedBookingRating} from './booking-rating-dialog.js?v=20261122-1';
import {renderBookingProgress} from './booking-progress.js?v=20261025-polish-1';
import {offerCompletionFeedback} from './feedback-prompt.js?v=20261119-feedback-1';
import {confirmCompletion,appendRecoveryControls,runRecovery} from './booking-recovery.js?v=20261116-1';
import {withCurrentBookingNames} from './booking-name-sync.js?v=20261030-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {sendBookingPush} from './push-events.js?v=20261004-1';
import {sendBookingEmail} from './booking-email-events.js?v=20261017-1';
import {askCancellationReason,cancellationLabel} from './booking-cancel.js?v=20261006-1';
const $=id=>document.getElementById(id);let client,user,rows=[],view=null,channel,reviewedBookings=new Set(),reviewLookupOk=false,ratingPromptOpen=false;
const validBookingId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linkedRequestId=(()=>{try{const id=new URL(location.href).searchParams.get('id')||'';return validBookingId.test(id)?id:''}catch{return ''}})();
let linkedRequestChecked=false,linkedRequestFocused=false;
const viewNames={sent:'My Requests',received:'Received',pending:'Pending',accepted:'Accepted',completed:'Completed',cancelled:'Cancelled',all:'All'};
function showMenu(){
 view=null;$('request-detail').hidden=true;$('request-menu').hidden=false;$('status').textContent='';
}
function openView(next,{focus=true}={}){
 if(!Object.hasOwn(viewNames,next))return;
 view=next;$('request-menu').hidden=true;$('request-detail').hidden=false;
 $('request-view-name').textContent=viewNames[next];render();
 if(focus)requestAnimationFrame(()=>{
  $('main')?.scrollIntoView({block:'start',behavior:'instant'});
  $('request-view-title')?.focus({preventScroll:true});
 });
}
const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
const cancelledStatuses=new Set(['cancelled','declined']);
function visible(r){
 if(!view)return false;
 if(view==='sent')return r.customer_id===user.id;
 if(view==='received')return r.companion_id===user.id;
 if(view==='cancelled')return cancelledStatuses.has(r.status);
 if(view==='all')return true;
 return r.status===view;
}
function requestCounts(items){
 const counts={sent:0,received:0,pending:0,accepted:0,completed:0,cancelled:0,all:items.length};
 for(const r of items){
  if(r.customer_id===user.id)counts.sent++;
  if(r.companion_id===user.id)counts.received++;
  if(r.status==='pending')counts.pending++;
  else if(r.status==='accepted')counts.accepted++;
  else if(r.status==='completed')counts.completed++;
  else if(cancelledStatuses.has(r.status))counts.cancelled++;
 }
 return counts;
}
function syncRequestCounts(){
 const counts=requestCounts(rows);
 document.querySelectorAll('[data-count-for]').forEach(node=>{
  node.textContent=String(counts[node.dataset.countFor]??0);
 });
 $('request-view-count').textContent=String(counts[view]??0);
}
function receivedCard(r){
 const n=el('article',undefined,'booking-card request-card');n.id='request-'+r.id;
 const top=el('div',undefined,'booking-top'),identity=el('div',undefined,'request-identity'),avatar=el('span',(r.customer_display_name||'S').trim().slice(0,1).toUpperCase(),'request-avatar'),left=el('div');
 left.append(el('h2',r.customer_display_name||'Sathivo member'),el('div',undefined,'booking-meta'));left.lastChild.append(el('span','Received by you'),el('span',r.category),el('span',r.meeting_mode==='in-person'?'In person':'Online'),el('span',fmt(r.requested_for)),el('span',r.duration_minutes+' min'));const price=el('div',undefined,'deal-box');if(r.listed_hourly_rate)price.append(el('span','Listed ₹'+Number(r.listed_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.offered_hourly_rate)price.append(el('strong','Customer offer ₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.agreed_hourly_rate)price.append(el('strong','Agreed ₹'+Number(r.agreed_hourly_rate).toLocaleString('en-IN')+'/hr','deal-agreed'));left.append(price);identity.append(avatar,left);top.append(identity,el('span',r.status,'status-pill'));n.append(top);
 if(r.note)n.append(el('p',r.note,'booking-note'));
 const a=el('div',undefined,'booking-actions');
 if(r.status==='pending'){
  const accept=el('button',r.offered_hourly_rate?'Accept ₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr':'Accept request','button button-primary'),decline=el('button','Decline request','button button-outline');
  accept.onclick=()=>{n.classList.add('request-accepting');accept.disabled=decline.disabled=true;void update(r.id,'accepted')};
  decline.onclick=()=>{if(confirm('Decline this booking request?')){accept.disabled=decline.disabled=true;void update(r.id,'declined')}};a.append(accept,decline);
 }else if(r.status==='accepted'){
  const chat=el('a','Open chat & photos ↗','button button-primary');chat.href='chat.html?booking='+encodeURIComponent(r.id);
  const done=el('button','Mark completed','button button-outline');done.onclick=async()=>{if(await confirmCompletion()){done.disabled=true;await update(r.id,'completed');done.disabled=false}};const cancel=el('button','Cancel booking','button button-outline');cancel.onclick=()=>void cancelBooking(r);a.append(chat,done,cancel);
 }
 appendRecoveryControls(a,r,user.id,recoverBooking);if(a.childNodes.length)n.append(a);if(r.status==='cancelled'&&r.cancel_reason)n.append(el('p','Cancelled · '+cancellationLabel(r.cancel_reason)+(r.cancel_note?' — '+r.cancel_note:''),'cancellation-note'));if(r.status==='accepted'&&r.agreed_hourly_rate)n.append(el('p','Deal recorded at ₹'+Number(r.agreed_hourly_rate).toLocaleString('en-IN')+'/hour. Coordinate details in chat. Payment stays outside Sathivo.','payment-note'));return n;
}
function sentCard(r){
 const n=el('article',undefined,'booking-card request-card');n.id='request-'+r.id;
 const top=el('div',undefined,'booking-top'),left=el('div');
 left.append(el('h2',r.companion_display_name||'Sathivo companion'));
 const meta=el('div',undefined,'booking-meta');
 meta.append(el('span','Sent by you'));
 if(r.category)meta.append(el('span',r.category));
 meta.append(el('span',r.meeting_mode==='in-person'?'In person':'Online'));
 if(r.requested_for)meta.append(el('span',fmt(r.requested_for)));
 if(r.duration_minutes)meta.append(el('span',r.duration_minutes+' min'));
 left.append(meta);top.append(left,el('span',r.status,'status-pill'));n.append(top);
 const progress=renderBookingProgress(r);if(progress)n.append(progress);
 const price=el('div',undefined,'deal-box');
 if(r.listed_hourly_rate)price.append(el('span','Listed ₹'+Number(r.listed_hourly_rate).toLocaleString('en-IN')+'/hr'));
 if(r.offered_hourly_rate)price.append(el('strong','Your offer ₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr'));
 if(r.agreed_hourly_rate)price.append(el('strong','Agreed ₹'+Number(r.agreed_hourly_rate).toLocaleString('en-IN')+'/hr','deal-agreed'));
 if(price.childNodes.length)n.append(price);
 if(r.note)n.append(el('p',r.note,'booking-note'));
 const a=el('div',undefined,'booking-actions');
 if(['pending','accepted'].includes(r.status)){
  const cancel=el('button','Cancel request','button button-outline');cancel.type='button';
  cancel.onclick=()=>void cancelBooking(r);a.append(cancel);
 }
 if(r.status==='accepted'){
  const chat=el('a','Open chat & photos ↗','button button-primary');
  chat.href='chat.html?booking='+encodeURIComponent(r.id);a.prepend(chat);
 }
 if(r.status==='completed'){
  if(reviewedBookings.has(r.id))n.append(el('p','✓ You rated this completed booking','booking-rated'));
  else if(reviewLookupOk){
   const rate=el('button','★ Rate your companion','button button-outline');rate.type='button';
   rate.onclick=()=>void rateBooking(r);a.append(rate);
  }
 }
 appendRecoveryControls(a,r,user.id,recoverBooking);
 if(a.childNodes.length)n.append(a);
 if(r.status==='cancelled'&&r.cancel_reason)n.append(el('p','Cancelled · '+cancellationLabel(r.cancel_reason)+(r.cancel_note?' — '+r.cancel_note:''),'cancellation-note'));
 if(r.agreed_hourly_rate)n.append(el('p','Sathivo does not collect or manage booking payments. Confirm payment directly with your companion. Never share UPI PINs or payment OTPs.','payment-note'));
 return n;
}
function card(r){return r.companion_id===user.id?receivedCard(r):sentCard(r)}
function render(){
 syncRequestCounts();
 if(!view){$('request-detail').hidden=true;$('request-menu').hidden=false;return}
 $('request-menu').hidden=true;$('request-detail').hidden=false;
 $('request-view-name').textContent=viewNames[view];
 const list=rows.filter(visible);
 $('requests').replaceChildren(...list.map(card));
 $('empty').hidden=list.length>0;
 $('request-empty-description').textContent=view==='sent'
  ?'Requests you send to companions will appear here.'
  :view==='received'?'Requests other people send to you will appear here.'
  :'No '+viewNames[view].toLowerCase()+' requests at the moment.';
 $('status').textContent='';
 if(!linkedRequestId)return;
 const target=document.getElementById('request-'+linkedRequestId);
 if(target){
  target.classList.add('request-highlight','request-email-focus');
  if(!linkedRequestFocused){
   linkedRequestFocused=true;target.setAttribute('tabindex','-1');
   requestAnimationFrame(()=>{target.scrollIntoView({behavior:'smooth',block:'center'});target.focus({preventScroll:true})});
  }
 }else if(!rows.some(r=>r.id===linkedRequestId)){
  $('status').textContent='This booking was not found in this account. Sign in with the account that sent or received the request.';
 }
}
async function load(){
 const [bookings,reviews]=await Promise.all([
  client.from('booking_requests').select('*').order('created_at',{ascending:false}),
  client.from('booking_reviews').select('booking_id').eq('reviewer_id',user.id)
 ]);
 if(bookings.error)throw bookings.error;
 const accessible=(bookings.data||[]).filter(r=>r.customer_id===user.id||r.companion_id===user.id);
 const prior=rows;rows=await withCurrentBookingNames(client,accessible);
 reviewLookupOk=!reviews.error;
 reviewedBookings=new Set((reviews.data||[]).map(r=>r.booking_id));
 const newlyCompleted=rows.some(r=>r.companion_id===user.id&&r.status==='completed'&&prior.some(p=>p.id===r.id&&p.status==='accepted'));
 if(newlyCompleted)offerCompletionFeedback(user);
 if(linkedRequestId&&!linkedRequestChecked){
  linkedRequestChecked=true;const requested=rows.find(r=>r.id===linkedRequestId);
  if(requested?.status==='accepted'&&requested.companion_id===user.id){
   location.replace('chat.html?booking='+encodeURIComponent(linkedRequestId));return;
  }
  if(requested)view=requested.companion_id===user.id?'received':'sent';
 }
 render();
}
async function cancelBooking(r){const answer=await askCancellationReason();if(!answer)return;await update(r.id,'cancelled',{cancel_reason:answer.reason,cancel_note:answer.note||null})}
async function recoverBooking(id,action){try{const result=await runRecovery(client,id,action);openView('all',{focus:false});await load();$('status').textContent=result==='accepted'?'Booking reopened.':result==='pending'?'Reopen request sent.':'Reopen request declined.';}catch(e){$('status').textContent=e.message||'Could not update recovery request.';}}
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
  if(status==='completed'){offerCompletionFeedback(user);openView('completed',{focus:false});await load();void sendBookingPush(client,id,status).catch(()=>{});}else{await sendBookingPush(client,id,status);await load();}
 }catch{
  $('status').textContent='Could not update this request. Please try again.';
 }finally{
  if(card){delete card.dataset.updating;card.removeAttribute('aria-busy');card.classList.remove('request-accepting');card.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
}
async function rateBooking(r){
 if(ratingPromptOpen||r.status!=='completed'||reviewedBookings.has(r.id)||r.customer_id!==user.id)return;
 ratingPromptOpen=true;
 try{
  const success=await showCompletedBookingRating({client,user,booking:r});
  if(success){reviewedBookings.add(r.id);render();$('status').textContent='Thanks for rating your completed booking.';}
 }catch{$('status').textContent='Could not open the rating form. Please try again.';}
 finally{ratingPromptOpen=false}
}
async function markLinkedNotification(){if(!linkedRequestId)return;await client.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).eq('link','requests.html?id='+linkedRequestId).is('read_at',null)}
async function init(){try{
 client=await getSathivoClient();
 const u=await client.auth.getUser();user=u.data.user;if(!user){if(linkedRequestId){const signIn=new URL('account.html',location.href);signIn.searchParams.set('next','requests.html?id='+linkedRequestId);signIn.hash='login';location.replace(signIn.href)}else location.replace('account.html#login');return}
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>openView(b.dataset.view)));
 $('request-back').addEventListener('click',()=>{
  showMenu();$('main')?.scrollIntoView({block:'start',behavior:'instant'});
  $('request-menu').querySelector('[data-view]')?.focus({preventScroll:true});
 });
 await markLinkedNotification();await load();
 channel=client.channel('incoming-requests:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void load()).subscribe();
 }catch(e){$('status').textContent=e.message||'Could not load requests.'}}
window.addEventListener('pagehide',()=>{if(channel)void client.removeChannel(channel)});void init();