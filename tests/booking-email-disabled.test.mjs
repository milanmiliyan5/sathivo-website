import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sendBookingEmail} from '../js/booking-email-events.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('booking emails are disabled at every delivery path, preserving push and auth',async()=>{
 for(const p of ['send-booking-email','scheduled-booking-reminders']){
  const s=await read('supabase/functions/'+p+'/index.ts');
  assert.doesNotMatch(s,/api\.resend\.com|RESEND_API_KEY|deliverEmail/);
 }
 const direct=await read('supabase/functions/send-booking-email/index.ts');
 assert.match(direct,/booking_email_disabled/);
 const scheduled=await read('supabase/functions/scheduled-booking-reminders/index.ts');
 assert.match(scheduled,/const email="disabled"/);
 assert.match(scheduled,/deliverWeb\(admin,row\)/);
 assert.match(scheduled,/deliverAndroid\(admin,row.target_user_id\)/);
 assert.match(scheduled,/claim_scheduled_booking_reminders/);
 assert.match(scheduled,/finish_scheduled_booking_reminder/);
 for(const p of ['js/requests-page.js','js/companions-page.js']){
  const s=await read(p);assert.doesNotMatch(s,/sendBookingEmail/);assert.match(s,/sendBookingPush/);
 }
 assert.equal(await sendBookingEmail({functions:{invoke(){throw Error('must not send')}}},'test','request'),false);
 const auth=await read('js/auth-flow.js');assert.match(auth,/resetPasswordForEmail/);assert.match(auth,/\.resend\(/);
});