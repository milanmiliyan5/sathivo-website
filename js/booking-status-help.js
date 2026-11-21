// Informational guide only. Does not query or modify private bookings.
export const bookingStatusAdvice=Object.freeze({
 pending:'Pending: the companion has not accepted the request. Do not treat it as a confirmed plan or send an advance payment solely because the request was submitted. You can monitor its status in My Bookings.',
 accepted:'Accepted: open the matching booking conversation and confirm the exact time, public place or online format, duration, boundaries and total expected costs before meeting. Sathivo did not automatically charge you.',
 declined:'Declined: that request was not accepted. Please respect the decision. You can browse a different published listing or consider another plan.',
 cancelled:'Cancelled: check any available cancellation reason. The booking is no longer an active plan. If money was transferred outside Sathivo, the platform cannot automatically refund it.',
 completed:'Completed: the booking was marked finished; this is not proof of payment or a particular experience. If a status appears wrong, use the available correction or support options.',
});
export function adviceForStatus(status){
 return bookingStatusAdvice[status]||bookingStatusAdvice.pending;
}
if(typeof document!=='undefined'){
 const select=document.getElementById('booking-stage'),output=document.getElementById('booking-stage-answer');
 if(select&&output){
  const update=()=>{output.textContent=adviceForStatus(select.value)};
  select.addEventListener('change',update);update();
 }
}
