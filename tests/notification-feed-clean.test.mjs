import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Notifications opens directly to feed controls while settings remain in Account',async()=>{
 const h=await read('notifications.html'),account=await read('account.html'),js=await read('js/notifications-page.js');
 assert.match(h,/<main[^>]*aria-label="Notifications"><h1 class="notify-heading">Notifications<\/h1><div class="notify-toolbar"/);
 assert.doesNotMatch(h,/WHAT'S NEW|data-push-settings|data-nearby-alert-settings|Not a confirmed booking/);
 for(const id of ['notify-count','notify-summary','mark-all-read','notify-error','status','notifications','empty'])assert.ok(h.includes('id="'+id+'"'),id);
 assert.match(h,/data-notify-filter="all"/);
 assert.match(h,/data-notify-filter="unread"/);
 assert.match(account,/data-push-settings/);
 assert.match(account,/data-nearby-alert-settings/);
 assert.match(js,/function markAllRead\(/);
 assert.match(js,/\.on\('postgres_changes'/);
 assert.doesNotMatch(await read('privacy.html'),/notifications\.html#nearby-alerts/);
});
