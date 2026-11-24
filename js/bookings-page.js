import {showCompletedBookingRating} from './booking-rating-dialog.js?v=20261122-1';
import {offerCompletionFeedback} from './feedback-prompt.js?v=20261119-feedback-1';
import {confirmCompletion,appendRecoveryControls,runRecovery,completionState,completionLabel,submitCompletion} from './booking-recovery.js?v=20261124-companion-completion-1';
import {withCurrentBookingNames} from './booking-name-sync.js?v=20261030-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {sendBookingPush} from './push-events.js?v=20261004-1';
import {askCancellationReason,cancellationLabel} from './booking-cancel.js?v=20261006-1';
import {renderBookingProgress,renderCompactRates,renderCompactPaymentNote} from './booking-progress.js?v=20261124-compact-booking-cards-1';
const $=id=>document.getElementById(id); let client,user,rows=[],filter='all',reviewedBookings=new Set(),reviewLookupOk=false,promptOpen=false;
const autoPrompted=new Set();

const linkedBookingId=(()=>{
 try{
  const id=new URL(location.href).searchParams.get('id')||'';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?id:'';
 }catch{return ''}
})();
let bookingFocused=false;

const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
function showBookingConfirmation(){
 const url=new URL(location.href);
 if(url.searchParams.get('booked')!=='1')return;
 url.searchParams.delete('booked');
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 const dialog=document.createElement('dialog');
 dialog.className='booking-success-dialog';
 dialog.setAttribute('aria-labelledby','booking-success-title');
 dialog.innerHTML=[
  '<div class="booking-success-content">',
   '<div class="booking-success-icon" aria-hidden="true">✓</div>',
   '<h2 id="booking-success-title">Your booking request is sent! 💖</h2>',
   '<p>We’ve saved your request. Your companion can now review it and choose to accept or decline.</p>',
   '<div class="booking-success-note"><span aria-hidden="true">✉️</span><p>',
   '<strong>How will you know?</strong>',
   'You can always see the latest status in <b>My Bookings</b>. When booking emails are enabled, we’ll also email you at your registered address if the request is accepted. Check your inbox and spam folder.',
   '</p></div>',
   '<div class="booking-success-actions">',
    '<button type="button" class="button button-primary booking-success-view">View My Bookings ↗</button>',
    '<button type="button" class="booking-success-later">Got it</button>',
   '</div>',
  '</div>'
 ].join('');
 document.body.append(dialog);
 const close=()=>dialog.close();
 dialog.querySelector('.booking-success-view').addEventListener('click',close);
 dialog.querySelector('.booking-success-later').addEventListener('click',close);
 dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 if(typeof dialog.showModal==='function')dialog.showModal();
 else dialog.remove();
}

function selectFilter(value){
 filter=value;
 for(const button of document.querySelectorAll('[data-filter]')){
  const selected=button.dataset.filter===value;
  button.classList.toggle('active',selected);
  button.setAttribute('aria-pressed',String(selected));
 }
}
function visible(r){if(filter==='all')return true;if(filter==='closed')return ['declined','cancelled'].includes(r.status);return r.status===filter}
function card(r){const mine=r.customer_id===user.id,other=mine?r.companion_display_name:r.customer_display_name,n=el('article',undefined,'booking-card booking-card-compact');n.id='booking-'+r.id;n.dataset.bookingStatus=r.status;
 const top=el('div',undefined,'booking-top'),left=el('div');left.append(el('h2',other||'Sathivo member'),el('div',undefined,'booking-meta'));left.lastChild.append(el('span',mine?'Sent by you':'Received by you'),el('span',r.category),el('span',r.meeting_mode==='in-person'?'In person':'Online'),el('span',fmt(r.requested_for)),el('span',r.duration_minutes+' min'));top.append(left,el('span',r.status,'status-pill'));n.append(top);const timeline=renderBookingProgress(r,{compact:true});if(timeline)n.append(timeline);
 const price=renderCompactRates(r,mine);if(price)n.append(price);if(r.note)n.append(el('p',r.note,'booking-note'));
 const a=el('div',undefined,'booking-actions');
 if(r.status==='pending'&&!mine){const review=el('a','Review request ↗','button button-primary');review.href='requests.html?id='+encodeURIComponent(r.id);a.append(review)}
 if(['pending','accepted'].includes(r.status)&&mine){const b=el('button','Cancel Request','button button-outline');b.onclick=()=>void cancelBooking(r);a.append(b)}
 if(completionState(r,user.id)==='ready'){const b=el('button',completionLabel(r,user.id),'button button-primary');b.onclick=async()=>{if(await confirmCompletion()){b.disabled=true;await finishBooking(r.id);b.disabled=false}};a.append(b)}
 if(r.status==='accepted'){const c=el('a','Open Chat ↗','button button-primary');c.href='chat.html?booking='+encodeURIComponent(r.id);a.prepend(c)}
 if(r.status==='completed'&&mine){
  if(reviewedBookings.has(r.id))n.append(el('p','✓ You rated this completed booking','booking-rated'));
  else if(reviewLookupOk){const rate=el('button','★ Rate your companion','button button-outline');
   rate.type='button';rate.onclick=()=>void rateBooking(r);
   a.append(rate);}
 }
 appendRecoveryControls(a,r,user.id,recoverBooking);if(a.childNodes.length)n.append(a);if(r.status==='cancelled'&&r.cancel_reason){const text='Cancelled · '+cancellationLabel(r.cancel_reason)+(r.cancel_note?' — '+r.cancel_note:'');n.append(el('p',text,'cancellation-note'))}if(r.agreed_hourly_rate)n.append(renderCompactPaymentNote());return n}
function render(){
 const list=rows.filter(visible);
 $('bookings').replaceChildren(...list.map(card));
 $('empty').hidden=list.length>0;
 const emptyCopy={
  all:['calendar','No bookings yet','Your booking requests will appear here.'],
  pending:['clock','No pending bookings','Requests awaiting a response will appear here.'],
  accepted:['calendar','No accepted bookings','Your active bookings will appear here.'],
  completed:['check','No completed bookings','Your completed bookings will appear here.'],
  closed:['cancel','No closed bookings','Cancelled and declined bookings will appear here.']
 }[filter]||['calendar','No bookings yet','Your booking requests will appear here.'];
 $('empty').dataset.emptyKind=emptyCopy[0];
 $('booking-empty-title').textContent=emptyCopy[1];
 $('booking-empty-copy').textContent=emptyCopy[2];
 $('booking-empty-explore').hidden=filter!=='all';
 $('status').textContent=list.length?list.length+' booking'+(list.length===1?'':'s')+'.':'';
 if(!linkedBookingId)return;
 const focused=document.getElementById('booking-'+linkedBookingId);
 if(focused){
  focused.classList.add('booking-email-highlight');
  if(!bookingFocused){
   bookingFocused=true;
   focused.setAttribute('tabindex','-1');
   requestAnimationFrame(()=>{focused.scrollIntoView({behavior:'smooth',block:'center'});focused.focus({preventScroll:true})});
  }
 }else if(!rows.some(r=>r.id===linkedBookingId)){
  $('status').textContent='This booking was not found in your account. Please sign in with the account linked to the booking.';
 }
}
async function load(){
 const [bookings,reviews]=await Promise.all([
  client.from('booking_requests').select('*').order('created_at',{ascending:false}),
  client.from('booking_reviews').select('booking_id').eq('reviewer_id',user.id)
 ]);
 if(bookings.error)throw bookings.error;
 const prior=rows;
 rows=await withCurrentBookingNames(client,bookings.data||[]);
 reviewLookupOk=!reviews.error;
 reviewedBookings=new Set((reviews.data||[]).map(r=>r.booking_id));
 const newlyCompleted=rows.some(r=>r.customer_id===user.id&&r.status==='completed'&&prior.some(old=>old.id===r.id&&old.status==='accepted'));
 if(newlyCompleted)offerCompletionFeedback(user);
 $('filters').hidden=false;render();
 // A completed booking is optional to rate, but the CTA stays in Completed forever.
 const unreviewed=reviewLookupOk&&rows.find(r=>r.customer_id===user.id&&r.status==='completed'&&!reviewedBookings.has(r.id)&&!autoPrompted.has(r.id));
 if(unreviewed&&document.visibilityState!=='hidden'){
  const storageKey='sathivo:rating-prompt:'+user.id+':'+unreviewed.id;
  try{if(localStorage.getItem(storageKey)==='1')return;localStorage.setItem(storageKey,'1');}catch{}
  autoPrompted.add(unreviewed.id);
  setTimeout(()=>{if(!document.querySelector('dialog[open]'))void rateBooking(unreviewed);},1100);
 }
}
async function cancelBooking(r){const answer=await askCancellationReason();if(!answer)return;await update(r.id,'cancelled',{cancel_reason:answer.reason,cancel_note:answer.note||null})}
async function recoverBooking(id,action){try{const result=await runRecovery(client,id,action);if(result==='accepted'){selectFilter('all');}await load();$('status').textContent=result==='accepted'?'Booking reopened.':result==='pending'?'Reopen request sent.':'Reopen request declined.';}catch(e){$('status').textContent=e.message||'Could not update recovery request.';}}
async function finishBooking(id){
 try{
  const result=await submitCompletion(client,id);
  if(result==='completed'){offerCompletionFeedback(user);selectFilter('all');void sendBookingPush(client,id,'completed');}
  await load();
  $('status').textContent='Booking completed.';
 }catch{$('status').textContent='Could not confirm completion. Please try again.';}
}
async function update(id,status,extra={}){$('status').textContent='Updating…';const {error}=await client.from('booking_requests').update({status,...extra}).eq('id',id);if(error){$('status').textContent=error.message;return}if(status==='completed'){offerCompletionFeedback(user);selectFilter('all');}if(['cancelled','completed'].includes(status)){ await load();void sendBookingPush(client,id,status).catch(()=>{});return}await load()}
async function rateBooking(booking){
 if(promptOpen||booking.status!=='completed'||reviewedBookings.has(booking.id))return;
 promptOpen=true;
 try{
  const success=await showCompletedBookingRating({client,user,booking});
  if(success){reviewedBookings.add(booking.id);render();$('status').textContent='Thanks for rating your completed plan.';}
 }finally{promptOpen=false;}
}
async function init(){try{client=await getSathivoClient();const u=await client.auth.getUser();user=u.data.user;if(!user){if(linkedBookingId){const signIn=new URL('account.html',location.href);signIn.searchParams.set('next','bookings.html?id='+linkedBookingId);signIn.hash='login';location.replace(signIn.href)}else location.replace('account.html#login');return}showBookingConfirmation();selectFilter(filter);document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{selectFilter(b.dataset.filter);render()});await load();client.channel('bookings:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void load()).subscribe()}catch(e){$('status').textContent=e.message||'Could not load bookings.'}}
void init();