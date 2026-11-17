import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationDate,notificationAge} from '../js/notification-time.js';

test('notification timestamps are actual dates and relative elapsed time',()=>{
 const created='2026-11-17T06:00:00Z',now=Date.parse('2026-11-17T06:02:00Z');
 assert.match(notificationDate(created),/2026/);
 assert.equal(notificationAge(created,now),'2 min ago');
 assert.equal(notificationAge(created,now+7200000),'2 hr ago');
 assert.equal(notificationAge(created,now+86400000),'1 day ago');
 assert.equal(notificationAge(created,now+259200000),'3 days ago');
 assert.equal(notificationAge(null,now),'');
 assert.equal(notificationDate('invalid'),'');
});
