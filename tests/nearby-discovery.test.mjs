import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('nearby emails are disabled without touching booking or security email',async()=>{
 const email=await read('supabase/functions/send-nearby-email/index.ts');
 const publish=await read('js/listing-publish.js');
 assert.match(email,/nearby_email_disabled/);
 assert.doesNotMatch(email,/api\.resend\.com/);
 assert.doesNotMatch(publish,/invoke\('send-nearby-email'/);
 assert.match(publish,/invoke\('send-nearby-push'/);
 assert.ok((await read('supabase/functions/send-booking-email/index.ts')).length>100);
});
test('nearby discovery only shows live listings after delay and keeps it per-user',async()=>{
 const code=await read('js/nearby-discovery.js');
 assert.match(code,/20\d{3}-(performance\.now\(\)-started)/);
 assert.match(code,/previouslySeen\(user\.id\)/);
 assert.match(code,/rememberSeen\(user\.id/);
 assert.match(code,/\.eq\('kind','nearby'\)/);
 assert.match(code,/\.eq\('published',true\)\.eq\('moderation_status','active'\)/);
 assert.match(code,/user_blocks/);
 assert.match(code,/touchstart/);
 assert.match(code,/touchend/);
 assert.match(code,/showModal/);
 assert.match(code,/companion\.html\?id=/);
});
test('nearby browser push requires explicit opt in, credentials and delivery dedupe',async()=>{
 const backend=await read('supabase/functions/send-nearby-push/index.ts');
 const settings=await read('js/nearby-alert-settings.js');
 const permissions=await read('js/push-settings.js');
 assert.match(backend,/auth\.getUser\(token\)/);
 assert.match(backend,/listing\.user_id!==actor/);
 assert.match(backend,/pref\?\.push_enabled===true/);
 assert.match(backend,/nearby_push_delivery_events/);
 assert.match(backend,/ignoreDuplicates:true/);
 assert.match(settings,/push_enabled:push\.checked/);
 assert.match(settings,/email_enabled:false/);
 assert.match(permissions,/Notification\.requestPermission\(\)/);
});
