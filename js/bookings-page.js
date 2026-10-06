import {getSathivoClient} from './supabase-client.js?v=20261006-1';
import {sendBookingPush} from './push-events.js?v=20261004-1';
const $=id=>document.getElementById(id); let client,user,rows=[],filter='all';
const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
function showBookingConfirmation(){
 const url=new URL(location.href);
 if(url.searchParams.get('booked')!=='1')return;
 const box=el('section',undefined,'booking-confirmation');
 box.append(el('strong','Booking request sent ✓'),el('p','Your request is saved. You can track its status below while the companion reviews it.'));
 const ad=el('div',undefined,'ad-slot ad-slot-large');ad.dataset.adSlot='booking-confirm';ad.hidden=true;
 $('status').before(box,ad);
 url.searchParams.delete('booked');
 history.replaceState(null,'',url.pathname+url.search+url.hash);
}
function visible(r){if(filter==='all')return true;if(filter==='closed')return ['declined','cancelled'].includes(r.status);return r.status===filter}
function card(r){const mine=r.customer_id===user.id,other=mine?r.companion_display_name:r.customer_display_name,n=el('article',undefined,'booking-card');
 const top=el('div',undefined,'booking-top'),left=el('div');left.append(el('h2',other||'Sathivo member'),el('div',undefined,'booking-meta'));left.lastChild.append(el('span',r.category),el('span',r.meeting_mode==='in-person'?'In person':'Online'),el('span',fmt(r.requested_for)),el('span',r.duration_minutes+' min'));top.append(left,el('span',r.status,'status-pill'));n.append(top);
 const price=el('div',undefined,'deal-box');if(r.listed_hourly_rate)price.append(el('span','Listed ₹'+Number(r.listed_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.offered_hourly_rate)price.append(el('span',(mine?'Your offer ':'Customer offer ')+'₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.agreed_hourly_rate)price.append(el('strong','Agreed ₹'+Number(r.agreed_hourly_rate).toLocaleString('en-IN')+'/hr','deal-agreed'));if(price.childNodes.length)n.append(price);if(r.note)n.append(el('p',r.note,'booking-note'));
 const a=el('div',undefined,'booking-actions');
 if(r.status==='pending'&&!mine){const review=el('a','Review request ↗','button button-primary');review.href='requests.html?id='+encodeURIComponent(r.id);a.append(review)}
 if(['pending','accepted'].includes(r.status)&&mine){const b=el('button','Cancel request','button button-outline');b.onclick=()=>update(r.id,'cancelled');a.append(b)}
 if(r.status==='accepted'&&!mine){const b=el('button','Mark completed','button button-primary');b.onclick=()=>update(r.id,'completed');a.append(b)}
 if(r.status==='accepted'){const c=el('a','Open chat & photos ↗','button button-outline');c.href='chat.html?booking='+encodeURIComponent(r.id);a.append(c)}
 if(r.status==='completed'&&mine){const review=el('form',undefined,'review-form');review.innerHTML='<strong>Leave a review</strong><select aria-label="Rating"><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Fair</option><option value="1">1 — Poor</option></select><textarea maxlength="600" rows="2" placeholder="Optional comment"></textarea><button class="button button-outline" type="submit">Submit review</button>';review.onsubmit=e=>{e.preventDefault();void submitReview(r,review)};n.append(review)}
 if(a.childNodes.length)n.append(a);if(r.agreed_hourly_rate)n.append(el('p','This accepted rate is recorded for coordination only. Pay the other person directly outside Sathivo using a method you both choose.','payment-note'));return n}
function render(){const list=rows.filter(visible);$('bookings').replaceChildren(...list.map(card));$('empty').hidden=list.length>0;$('status').textContent=list.length?list.length+' booking'+(list.length===1?'':'s')+'.':''}
async function load(){const {data,error}=await client.from('booking_requests').select('*').order('created_at',{ascending:false});if(error)throw error;rows=data||[];$('filters').hidden=false;render()}
async function update(id,status){$('status').textContent='Updating…';const {error}=await client.from('booking_requests').update({status}).eq('id',id);if(error){$('status').textContent=error.message;return}if(['cancelled','completed'].includes(status)){ $('status').textContent='Sending notification…';await sendBookingPush(client,id,status)}await load()}
async function submitReview(r,form){const rating=Number(form.querySelector('select').value),comment=form.querySelector('textarea').value.trim();const {error}=await client.from('booking_reviews').insert({booking_id:r.id,reviewer_id:user.id,companion_id:r.companion_id,rating,comment});if(error){$('status').textContent=error.code==='23505'?'You already reviewed this booking.':error.message;return}form.replaceWith(el('p','Thanks for your review.','launch-note'))}
async function init(){try{client=await getSathivoClient();const u=await client.auth.getUser();user=u.data.user;if(!user){location.replace('account.html#login');return}showBookingConfirmation();document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render()});await load();client.channel('bookings:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void load()).subscribe()}catch(e){$('status').textContent=e.message||'Could not load bookings.'}}
void init();