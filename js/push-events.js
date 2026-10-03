export async function sendBookingPush(client,bookingId,event){
 try{
  const {error}=await client.functions.invoke('send-booking-push',{body:{booking_id:bookingId,event}});
  if(error)console.warn('Push notification could not be sent:',error.message||error);
 }catch(error){console.warn('Push notification could not be sent:',error)}
}

export async function sendMessagePush(client,bookingId,messageId){
 try{
  const {error}=await client.functions.invoke('send-booking-push',{body:{booking_id:bookingId,event:'message',message_id:messageId}});
  if(error)console.warn('Message push notification could not be sent:',error.message||error);
 }catch(error){console.warn('Message push notification could not be sent:',error)}
}
