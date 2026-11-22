// Opt-in review after completed booking; returning false never changes booking.
export async function showCompletedBookingRating({client,user,booking}){
 if(!user||booking?.customer_id!==user.id||booking?.status!=='completed')return false;
 const d=document.createElement('dialog');d.className='booking-rating-dialog';
 d.setAttribute('aria-labelledby','booking-rating-title');
 d.innerHTML='<div class="booking-rating-body"><div class="booking-rating-icon">★</div><h2 id="booking-rating-title">How was your plan?</h2><p>This booking is completed. Rating is optional; you can also rate it later from Completed bookings.</p><div class="booking-rating-stars" role="group" aria-label="Star rating"></div><p class="booking-rating-value">5 out of 5 stars</p><label class="booking-rating-comment">Your experience (optional)<textarea rows="3" maxlength="600" placeholder="Share respectful feedback"></textarea></label><label class="booking-rating-consent"><input type="checkbox"> Show my written comment anonymously on the companion’s public profile</label><p class="booking-rating-error" role="alert" hidden></p><div class="booking-rating-actions"><button type="button" class="button button-outline booking-rating-later">Not now</button><button type="button" class="button button-primary booking-rating-submit">Submit rating</button></div></div>';
 document.body.append(d);
 let rating=5,busy=false,resolve;const completion=new Promise(fn=>resolve=fn);
 const box=d.querySelector('.booking-rating-stars'),summary=d.querySelector('.booking-rating-value');
 const buttons=Array.from({length:5},(_,index)=>{
  const b=document.createElement('button');b.type='button';b.className='booking-rating-star';
  b.setAttribute('aria-label',(index+1)+' stars');box.append(b);
  b.addEventListener('click',()=>{if(!busy){rating=index+1;update();}});return b;
 });
 const update=()=>{buttons.forEach((b,i)=>{b.textContent=i<rating?'★':'☆';b.setAttribute('aria-pressed',String(i+1===rating));});summary.textContent=rating+' out of 5 stars';};
 update();
 let finished=false;
 const close=value=>{if(finished)return;finished=true;resolve(value);if(d.open)d.close();else d.remove();};
 d.querySelector('.booking-rating-later').addEventListener('click',()=>close(false));
 d.addEventListener('cancel',()=>close(false));
 d.addEventListener('close',()=>{d.remove();if(!finished)close(false)},{once:true});
 d.querySelector('.booking-rating-submit').addEventListener('click',async()=>{
  if(busy)return;busy=true;
  const submit=d.querySelector('.booking-rating-submit'),errorBox=d.querySelector('.booking-rating-error');
  submit.disabled=true;submit.textContent='Saving…';errorBox.hidden=true;
  const comment=d.querySelector('textarea').value.trim();
  const isPublic=Boolean(comment)&&d.querySelector('input[type=checkbox]').checked;
  try{
   const {error}=await client.from('booking_reviews').insert({
    booking_id:booking.id,reviewer_id:user.id,companion_id:booking.companion_id,
    rating,comment,is_public_comment:isPublic
   });
   if(error)throw error;close(true);
  }catch(error){
   errorBox.hidden=false;errorBox.textContent=error?.code==='23505'
    ?'You already rated this booking. Refresh your Completed list.'
    :'Could not save rating. Please try again.';
  }finally{busy=false;submit.disabled=false;submit.textContent='Submit rating';}
 });
 if(typeof d.showModal==='function')d.showModal();else close(false);
 return completion;
}
