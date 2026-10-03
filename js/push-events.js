export async function sendBookingPush(client,bookingId,event){
 try{
  const {error}=await client.functions.invoke('send-booking-push',{body:{booking_id:bookingId,event}});
  if(error)console.warn('Push notification could not be sent:',error.message||error);
 }catch(error){console.warn('Push notification could not be sent:',error)}
}