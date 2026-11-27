import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paymentSafetyEligible} from '../js/payment-safety-popup.js';
const booking={id:'booking',status:'accepted',customer_id:'customer',companion_id:'companion'};
test('payment reminder only applies to accepted companion chats',()=>{
 assert.equal(paymentSafetyEligible(booking,'companion'),true);
 for(const uid of ['customer','stranger',null])assert.equal(paymentSafetyEligible(booking,uid),false);
 for(const status of ['pending','cancelled','completed','declined'])assert.equal(paymentSafetyEligible({...booking,status},'companion'),false);
});
test('payment reminder is not an automatic chat message',()=>{
 const js=readFileSync(new URL('../js/payment-safety-popup.js',import.meta.url),'utf8');
 assert.match(js,/booking_payment_safety_acknowledgements/);
 assert.doesNotMatch(js,/booking_messages|sendMessagePush/);
 const chat=readFileSync(new URL('../js/chat-page.js',import.meta.url),'utf8');
 assert.match(chat,/syncPaymentSafety\(\);/);
 assert.match(chat,/payment-safety-help/);
});
