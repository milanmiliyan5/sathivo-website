import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eligible,DAY,FIRST_DELAY} from '../js/feedback-prompt.js';
const now=Date.parse('2026-11-19T10:00:00Z');
const user={id:'test',created_at:new Date(now-DAY).toISOString()};
test('first automatic prompt starts at 24 hours, with ten second delay',()=>{
 assert.equal(FIRST_DELAY,10000);
 assert.equal(eligible(user,{},now-1),false);
 assert.equal(eligible(user,{},now),true);
 assert.equal(eligible(null,{},now),false);
});
test('completion can prompt earlier, without bypassing daily and cooldown limits',()=>{
 assert.equal(eligible(user,{},now-1,true),true);
 assert.equal(eligible(user,{lastShown:now-1000},now,true),false);
 assert.equal(eligible(user,{lastShown:now-DAY},now,true),true);
 for(const days of [7,30]){
  assert.equal(eligible(user,{until:now+days*DAY},now,true),false);
  assert.equal(eligible(user,{until:now+days*DAY},now+days*DAY),true);
 }
});
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('feedback shortcut is directly before bell and old form remains connected',async()=>{
 assert.match(await read('account.html'),/class="feedback-shortcut"[\s\S]*?<\/a><a class="notification-shortcut"/);
 assert.match(await read('index.html'),/href="feedback.html">Feedback/);
 assert.match(await read('support.html'),/href="feedback.html"/);
 assert.match(await read('js/feedback-page.js'),/if\(error\)throw error;\s*if\(feedbackUser\?\.id\)recordFeedbackSubmitted/);
 assert.match(await read('js/feedback-page.js'),/functions.invoke\('submit-support'/);
});
test('completion checks only successful updates or accepted to completed transitions',async()=>{
 for(const file of ['js/bookings-page.js','js/requests-page.js']){
  const js=await read(file);
  assert.match(js,/r.status==='completed'&&(?:rows|prior).some\(old=>old.id===r.id&&old.status==='accepted'\)/);
  assert.match(js,/if\(status==='completed'\)\{offerCompletionFeedback\(user\)/);
 }
 for(const file of ['chat.html','profile.html','companion.html'])assert.doesNotMatch(await read(file),/feedback-prompt\.js/);
});
