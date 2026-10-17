// Booking emails are best-effort: the booking itself must never fail or be
// rolled back because an email provider is unavailable.
export async function sendBookingEmail(client,bookingId,event){
 try{
  const {data,error}=await client.functions.invoke('send-booking-email',{
   body:{booking_id:bookingId,event}
  });
  if(error||data?.error){
   console.warn('Sathivo booking email unavailable:',error?.message||data?.error);
   return false;
  }
  return Boolean(data?.ok);
 }catch(error){
  console.warn('Sathivo booking email unavailable:',error?.message||error);
  return false;
 }
}
