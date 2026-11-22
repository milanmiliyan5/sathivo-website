import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Only completed booking customer can rate, and only once',async()=>{
 const ratings=await read('js/booking-rating-dialog.js'),page=await read('js/bookings-page.js');
 assert.match(ratings,/booking\?\.customer_id!==user.id/);
 assert.match(ratings,/booking\?\.status!=='completed'/);
 assert.match(ratings,/from\('booking_reviews'\)\.insert/);
 assert.match(ratings,/is_public_comment:isPublic/);
 assert.match(ratings,/Not now/);
 assert.match(page,/reviewedBookings\.has\(r.id\)/);
 assert.match(page,/rateBooking\(r\)/);
 assert.match(page,/sessionStorage\.getItem\(storageKey\)/);
 assert.match(page,/client\.from\('booking_reviews'\)\.select\('booking_id'\)/);
});
test('Completed bookings always retain review action if not yet rated',async()=>{
 const page=await read('js/bookings-page.js');
 assert.match(page,/r.status==='completed'&&mine/);
 assert.match(page,/★ Rate your companion/);
 assert.match(page,/✓ You rated this completed booking/);
 assert.match(await read('bookings.html'),/bookings-page\.js\?v=20261122-ratings-1/);
});