import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/companions-page.js',import.meta.url),'utf8');
const ctx=vm.createContext({Date});
vm.runInContext(source.slice(source.indexOf('function bookingLocalParts('),source.indexOf('function bookingChoices(')),ctx);
test('booking date/time preserves local time and rejects invalid days',()=>{
 const parsed=ctx.bookingLocalDate('2027-01-15','17:42');
 assert.equal(parsed.getFullYear(),2027);assert.equal(parsed.getMonth(),0);assert.equal(parsed.getDate(),15);assert.equal(parsed.getHours(),17);assert.equal(parsed.getMinutes(),42);
 assert.equal(ctx.bookingLocalDate('2027-02-30','17:42'),null);
 assert.equal(ctx.bookingLocalDate('2027-01-15','24:00'),null);
 assert.equal(ctx.bookingLocalDate('','17:42'),null);
 assert.ok(ctx.bookingMinimum().getTime()>=Date.now()+29*60000);
});
test('compact booking retains all backend request arguments and safety',()=>{
 const form=source.slice(source.indexOf('function bookingForm('),source.indexOf('// Detail-only photo overlay'));
 for(const part of ['create_booking_request_with_offer','p_companion_public_id:r.public_id','p_category:category.value','p_meeting_mode:mode.value','p_requested_for:iso','p_duration_minutes:Number(duration.value)','p_note:note.value.trim()','p_offer_hourly_rate:offerRate','sendBookingPush','booked=1','experienceSafetyNote(category.value)','No payment protection','booking-safety-details','booking-confirmation-note'])assert.ok(form.includes(part),part);
 for(const n of ['30','60','90','120','180'])assert.ok(form.includes("['"+n+"',"));
 assert.match(form,/access!=='other'\|\|!currentUser/);
});
