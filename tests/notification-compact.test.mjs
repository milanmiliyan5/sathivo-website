import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {importantNotificationQuery,notificationType,routineNotificationTitles} from '../js/notification-feed.js';
test('routine reminders excluded; website announcements intact',()=>{
 const calls=[];const q={not(...args){calls.push(args);return this}};
 assert.equal(importantNotificationQuery(q,'notifications'),q);
 assert.deepEqual(calls,[['title','in','('+routineNotificationTitles.map(x=>'"'+x+'"').join(',')+')']]);
 assert.equal(importantNotificationQuery(q,'website_notifications'),q);assert.equal(calls.length,1);
 for(const title of ['New booking request','Request accepted','Booking completed','Booking cancelled','Request declined','New message','New photo','Support replied'])assert.ok(!routineNotificationTitles.includes(title));
 assert.equal(notificationType({title:'Support replied',kind:'system'}),'support');
});
test('compact rows preserve safe navigation and read operations',async()=>{
 const j=await readFile(new URL('../js/notifications-page.js',import.meta.url),'utf8');
 const h=await readFile(new URL('../js/header-notifications.js',import.meta.url),'utf8');
 assert.match(j,/el\(link\?'a':'button',undefined,'notify-row'\)/);
 assert.match(j,/if\(!r.read_at\)await markOne\(r\)/);
 assert.match(j,/importantNotificationQuery\(client.from\(table\).select/);
 assert.match(h,/importantNotificationQuery\(client.from\(table\).select/);
 assert.doesNotMatch(j,/button button-primary notify-open|notify-mark-single/);
});
