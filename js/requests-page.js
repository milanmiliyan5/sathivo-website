import {showCompletedBookingRating} from './booking-rating-dialog.js?v=20261122-1';
import {renderBookingProgress,renderCompactRates,renderCompactPaymentNote} from './booking-progress.js?v=20261124-compact-booking-cards-1';
import {offerCompletionFeedback} from './feedback-prompt.js?v=20261119-feedback-1';
import {confirmCompletion,appendRecoveryControls,runRecovery,completionState,completionLabel,submitCompletion} from './booking-recovery.js?v=20261124-companion-completion-1';
import {withCurrentBookingNames} from './booking-name-sync.js?v=20261030-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {sendBookingPush} from './push-events.js?v=20261004-1';
import {askCancellationReason,cancellationLabel} from './booking-cancel.js?v=20261006-1';
const $=id=>document.getElementById(id);let client,user,rows=[],view=null,channel,reviewedBookings=new Set(),reviewLookupOk=false,ratingPromptOpen=false;
const validBookingId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linkedRequestId=(()=>{try{const id=new URL(location.href).searchParams.get('id')||'';return validBookingId.test(id)?id:''}catch{return ''}})();
let linkedRequestChecked=false,linkedRequestFocused=false;
const viewNames={sent:'Sent Requests',received:'Received Requests',ongoing:'Ongoing',completed:'Completed',cancelled:'Cancelled'};
function requestHistory(state){
 const entry=state?.sathivoRequests;
 if(!entry)return null;
 // Normalize browser history created by the previous seven-card layout.
 const next=entry.view==='accepted'?'ongoing':['pending','all'].includes(entry.view)?null:entry.view;
 if(!(next===null||Object.hasOwn(viewNames,next)))return null;
 return {view:next,fromMenu:next!==null&&entry.fromMenu===true};
}
let requestBackPending=false;
function writeRequestHistory(mode='replaceState',fromMenu=false){
 history[mode]({sathivoRequests:{view,fromMenu}},'',location.href);
}
function showMenu(){
 view=null;$('request-detail').hidden=true;$('request-menu').hidden=false;$('status').textContent='';
}
function focusRequestMenu(){
 window.scrollTo({top:0,left:0,behavior:'instant'});
 $('request-menu').querySelector('[data-view]')?.focus({preventScroll:true});
}
function openView(next,{focus=true,record=true}={}){
 if(!Object.hasOwn(viewNames,next)||requestBackPending)return;
 const fromMenu=view===null;
 const previous=requestHistory(history.state);
 view=next;
 if(record)writeRequestHistory(fromMenu?'pushState':'replaceState',fromMenu||!!previous?.fromMenu);
$('request-menu').hidden=true;$('request-detail').hidden=false;
 $('request-view-name').textContent=viewNames[next];render();
 if(focus)requestAnimationFrame(()=>{
  window.scrollTo({top:0,left:0,behavior:'instant'});
  $('request-view-title')?.focus({preventScroll:true});
 });
}
const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
const cancelledStatuses=new Set(['cancelled','declined']);
// Each booking has exactly one destination, determined by its current status and direction.
function linkedRequestView(r,uid){
 if(!uid||(r.customer_id!==uid&&r.companion_id!==uid))return null;
 if(r.status==='completed')return 'completed';
 if(cancelledStatuses.has(r.status))return 'cancelled';
 if(r.status==='accepted')return 'ongoing';
 if(r.status==='pending')return r.customer_id===uid?'sent':'received';
 return null;
}
function matchesRequestView(r,section,uid){
 return !!section&&linkedRequestView(r,uid)===section;
}
function visible(r){return matchesRequestView(r,view,user?.id)}
function requestCounts(items){
 const counts={sent:0,received:0,ongoing:0,completed:0,cancelled:0};
 for(const r of items){
  const section=linkedRequestView(r,user?.id);
  if(section)counts[section]++;
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
 const n=el('article',undefined,'booking-card request-card booking-card-compact');n.id='request-'+r.id;n.dataset.bookingStatus=r.status;
 const top=el('div',undefined,'booking-top'),identity=el('div',undefined,'request-identity'),avatar=el('span',(r.customer_display_name||'S').trim().slice(0,1).toUpperCase(),'request-avatar'),left=el('div');
 left.append(el('h2',r.customer_display_name||'Sathivo member'),el('div',undefined,'booking-meta'));left.lastChild.append(el('span','Received by you'),el('span',r.category),el('span',r.meeting_mode==='in-person'?'In person':'Online'),el('span',fmt(r.requested_for)),el('span',r.duration_minutes+' min'));identity.append(avatar,left);top.append(identity,el('span',r.status,'status-pill'));n.append(top);
 const progress=renderBookingProgress(r,{compact:true});if(progress)n.append(progress);
 const price=renderCompactRates(r,false);if(price)n.append(price);
 if(r.note)n.append(el('p',r.note,'booking-note'));
 const a=el('div',undefined,'booking-actions');
 if(r.status==='pending'){
  const accept=el('button',r.offered_hourly_rate?'Accept ₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr':'Accept request','button button-primary'),decline=el('button','Decline request','button button-outline');
  accept.onclick=()=>{n.classList.add('request-accepting');accept.disabled=decline.disabled=true;void update(r.id,'accepted')};
  decline.onclick=()=>{if(confirm('Decline this booking request?')){accept.disabled=decline.disabled=true;void update(r.id,'declined')}};a.append(accept,decline);
 }else if(r.status==='accepted'){
  const chat=el('a','Open Chat ↗','button button-primary');chat.href='chat.html?booking='+encodeURIComponent(r.id);
  a.append(chat);
  if(completionState(r,user.id)==='ready'){
   const done=el('button',completionLabel(r,user.id),'button button-outline');done.onclick=async()=>{if(await confirmCompletion()){done.disabled=true;await finishBooking(r.id);done.disabled=false}};a.append(done);
  }
  const cancel=el('button','Cancel Booking','button button-outline');cancel.onclick=()=>void cancelBooking(r);a.append(cancel);
 }
 appendRecoveryControls(a,r,user.id,recoverBooking);if(a.childNodes.length)n.append(a);if(r.status==='cancelled'&&r.cancel_reason)n.append(el('p','Cancelled · '+cancellationLabel(r.cancel_reason)+(r.cancel_note?' — '+r.cancel_note:''),'cancellation-note'));if(r.status==='accepted'&&r.agreed_hourly_rate)n.append(renderCompactPaymentNote());return n;
}
function sentCard(r){
 const n=el('article',undefined,'booking-card request-card booking-card-compact');n.id='request-'+r.id;n.dataset.bookingStatus=r.status;
 const top=el('div',undefined,'booking-top'),left=el('div');
 left.append(el('h2',r.companion_display_name||'Sathivo companion'));
 const meta=el('div',undefined,'booking-meta');
 meta.append(el('span','Sent by you'));
 if(r.category)meta.append(el('span',r.category));
 meta.append(el('span',r.meeting_mode==='in-person'?'In person':'Online'));
 if(r.requested_for)meta.append(el('span',fmt(r.requested_for)));
 if(r.duration_minutes)meta.append(el('span',r.duration_minutes+' min'));
 left.append(meta);top.append(left,el('span',r.status,'status-pill'));n.append(top);
 const progress=renderBookingProgress(r,{compact:true});if(progress)n.append(progress);
 const price=renderCompactRates(r,true);if(price)n.append(price);
 if(r.note)n.append(el('p',r.note,'booking-note'));
 const a=el('div',undefined,'booking-actions');
 if(['pending','accepted'].includes(r.status)){
  const cancel=el('button','Cancel Request','button button-outline');cancel.type='button';
  cancel.onclick=()=>void cancelBooking(r);a.append(cancel);
 }
 if(r.status==='accepted'){
  const chat=el('a','Open Chat ↗','button button-primary');
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
 if(r.agreed_hourly_rate)n.append(renderCompactPaymentNote());
 return n;
}
function card(r){return r.companion_id===user.id?receivedCard(r):sentCard(r)}
function render(){
 syncRequestCounts();
 if(!view){$('status').textContent='';$('request-detail').hidden=true;$('request-menu').hidden=false;return}
 $('request-menu').hidden=true;$('request-detail').hidden=false;
 $('request-view-name').textContent=viewNames[view];
 const list=rows.filter(visible);
 $('requests').replaceChildren(...list.map(card));
 $('empty').hidden=list.length>0;
 const emptyCopy={
  sent:['send','No sent requests','Requests you send will appear here while awaiting a response.'],
  received:['inbox','No received requests','New incoming requests awaiting your response will appear here.'],
  ongoing:['calendar','No ongoing bookings','Your accepted bookings will appear here.'],
  completed:['check','No completed bookings','Your completed bookings will appear here.'],
  cancelled:['cancel','No cancelled bookings','Cancelled and declined requests will appear here.']
 }[view];
 $('empty').dataset.emptyKind=emptyCopy[0];
 $('request-empty-title').textContent=emptyCopy[1];
 $('request-empty-description').textContent=emptyCopy[2];
 $('request-empty-explore').hidden=view!=='sent';
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
  client.from('booking_requests').select('*').or('customer_id.eq.'+user.id+',companion_id.eq.'+user.id).order('created_at',{ascending:false}),
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
  if(requested?.status==='accepted'&&requested.companion_id===user.id&&!requestHistory(history.state)?.view){
   location.replace('chat.html?booking='+encodeURIComponent(linkedRequestId));return;
  }
  if(requested&&(!requestHistory(history.state)?.view||!matchesRequestView(requested,view,user.id))){
   view=linkedRequestView(requested,user.id);
   writeRequestHistory('replaceState',false);
  }
 }
 render();
}
async function cancelBooking(r){const answer=await askCancellationReason();if(!answer)return;await update(r.id,'cancelled',{cancel_reason:answer.reason,cancel_note:answer.note||null})}
async function recoverBooking(id,action){try{const result=await runRecovery(client,id,action);openView(result==='accepted'?'ongoing':'completed',{focus:false});await load();$('status').textContent=result==='accepted'?'Booking reopened.':result==='pending'?'Reopen request sent.':'Reopen request declined.';}catch(e){$('status').textContent=e.message||'Could not update recovery request.';}}
async function finishBooking(id){
 try{
  const result=await submitCompletion(client,id);
  if(result==='completed'){offerCompletionFeedback(user);openView('completed',{focus:false});void sendBookingPush(client,id,'completed');}
  await load();
  $('status').textContent='Booking completed.';
 }catch{$('status').textContent='Could not confirm completion. Please try again.';}
}
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
   await sendBookingPush(client,id,status);
   location.href='chat.html?booking='+encodeURIComponent(id);return;
  }
  if(status==='completed'){offerCompletionFeedback(user);openView('completed',{focus:false});await load();void sendBookingPush(client,id,status).catch(()=>{});}else{if(cancelledStatuses.has(status))openView('cancelled',{focus:false});await sendBookingPush(client,id,status);await load();}
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
 const restored=requestHistory(history.state);
 if(restored){view=restored.view;linkedRequestChecked=true;}
 else writeRequestHistory('replaceState',false);
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>openView(b.dataset.view)));
 $('request-back').addEventListener('click',()=>{
  if(requestBackPending)return;
  const entry=requestHistory(history.state);
  if(entry?.view===view&&entry.fromMenu){requestBackPending=true;history.back();return;}
  showMenu();writeRequestHistory();focusRequestMenu();
 });
 window.addEventListener('popstate',event=>{
  requestBackPending=false;
  const entry=requestHistory(event.state);
  if(!entry)return;
  if(entry.view===null){showMenu();focusRequestMenu();}
  else openView(entry.view,{record:false});
 });
 await markLinkedNotification();await load();
 channel=client.channel('incoming-requests:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void load()).subscribe();
 }catch(e){$('status').textContent=e.message||'Could not load requests.'}}
window.addEventListener('pagehide',()=>{if(channel)void client.removeChannel(channel)});void init();