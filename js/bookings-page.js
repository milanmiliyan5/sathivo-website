import {withCurrentBookingNames} from './booking-name-sync.js?v=20261030-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {sendBookingPush} from './push-events.js?v=20261004-1';
import {askCancellationReason,cancellationLabel} from './booking-cancel.js?v=20261006-1';
import {renderBookingProgress} from './booking-progress.js?v=20261025-polish-1';
const $=id=>document.getElementById(id); let client,user,rows=[],filter='all';

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

function visible(r){if(filter==='all')return true;if(filter==='closed')return ['declined','cancelled'].includes(r.status);return r.status===filter}
function card(r){const mine=r.customer_id===user.id,other=mine?r.companion_display_name:r.customer_display_name,n=el('article',undefined,'booking-card');n.id='booking-'+r.id;
 const top=el('div',undefined,'booking-top'),left=el('div');left.append(el('h2',other||'Sathivo member'),el('div',undefined,'booking-meta'));left.lastChild.append(el('span',r.category),el('span',r.meeting_mode==='in-person'?'In person':'Online'),el('span',fmt(r.requested_for)),el('span',r.duration_minutes+' min'));top.append(left,el('span',r.status,'status-pill'));n.append(top);if(mine){const timeline=renderBookingProgress(r);if(timeline)n.append(timeline)}
 const price=el('div',undefined,'deal-box');if(r.listed_hourly_rate)price.append(el('span','Listed ₹'+Number(r.listed_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.offered_hourly_rate)price.append(el('span',(mine?'Your offer ':'Customer offer ')+'₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.agreed_hourly_rate)price.append(el('strong','Agreed ₹'+Number(r.agreed_hourly_rate).toLocaleString('en-IN')+'/hr','deal-agreed'));if(price.childNodes.length)n.append(price);if(r.note)n.append(el('p',r.note,'booking-note'));
 const a=el('div',undefined,'booking-actions');
 if(r.status==='pending'&&!mine){const review=el('a','Review request ↗','button button-primary');review.href='requests.html?id='+encodeURIComponent(r.id);a.append(review)}
 if(['pending','accepted'].includes(r.status)&&mine){const b=el('button','Cancel request','button button-outline');b.onclick=()=>void cancelBooking(r);a.append(b)}
 if(r.status==='accepted'&&!mine){const b=el('button','Mark completed','button button-primary');b.onclick=()=>update(r.id,'completed');a.append(b)}
 if(r.status==='accepted'&&!mine){const c=el('a','Open chat & photos ↗','button button-outline');c.href='chat.html?booking='+encodeURIComponent(r.id);a.append(c)}
 if(r.status==='completed'&&mine){const review=el('form',undefined,'review-form');review.innerHTML='<strong>Leave a review</strong><select aria-label="Rating"><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Fair</option><option value="1">1 — Poor</option></select><textarea maxlength="600" rows="2" placeholder="Optional comment"></textarea><button class="button button-outline" type="submit">Submit review</button>';review.onsubmit=e=>{e.preventDefault();void submitReview(r,review)};n.append(review)}
 if(a.childNodes.length)n.append(a);if(r.status==='cancelled'&&r.cancel_reason){const text='Cancelled · '+cancellationLabel(r.cancel_reason)+(r.cancel_note?' — '+r.cancel_note:'');n.append(el('p',text,'cancellation-note'))}if(r.agreed_hourly_rate)n.append(el('p','This accepted rate is recorded for coordination only. Pay the other person directly outside Sathivo using a method you both choose.','payment-note'));return n}
function render(){
 const list=rows.filter(visible);
 $('bookings').replaceChildren(...list.map(card));
 $('empty').hidden=list.length>0;
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
async function load(){const {data,error}=await client.from('booking_requests').select('*').order('created_at',{ascending:false});if(error)throw error;rows=await withCurrentBookingNames(client,data||[]);$('filters').hidden=false;render()}
async function cancelBooking(r){const answer=await askCancellationReason();if(!answer)return;await update(r.id,'cancelled',{cancel_reason:answer.reason,cancel_note:answer.note||null})}
async function update(id,status,extra={}){$('status').textContent='Updating…';const {error}=await client.from('booking_requests').update({status,...extra}).eq('id',id);if(error){$('status').textContent=error.message;return}if(['cancelled','completed'].includes(status)){ $('status').textContent='Sending notification…';await sendBookingPush(client,id,status)}await load()}
async function submitReview(r,form){const rating=Number(form.querySelector('select').value),comment=form.querySelector('textarea').value.trim();const {error}=await client.from('booking_reviews').insert({booking_id:r.id,reviewer_id:user.id,companion_id:r.companion_id,rating,comment});if(error){$('status').textContent=error.code==='23505'?'You already reviewed this booking.':error.message;return}form.replaceWith(el('p','Thanks for your review.','launch-note'))}
async function init(){try{client=await getSathivoClient();const u=await client.auth.getUser();user=u.data.user;if(!user){if(linkedBookingId){const signIn=new URL('account.html',location.href);signIn.searchParams.set('next','bookings.html?id='+linkedBookingId);signIn.hash='login';location.replace(signIn.href)}else location.replace('account.html#login');return}showBookingConfirmation();document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render()});await load();client.channel('bookings:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void load()).subscribe()}catch(e){$('status').textContent=e.message||'Could not load bookings.'}}
void init();