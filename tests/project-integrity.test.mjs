import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const read=p=>readFile(path.join(root,p),'utf8');

test('shared browser Supabase client is the only persistent auth client', async()=>{
  const entries=await readdir(path.join(root,'js'),{withFileTypes:true});
  const offenders=[];
  for(const entry of entries){
    if(!entry.isFile()||!entry.name.endsWith('.js'))continue;
    const source=await read('js/'+entry.name);
    if(source.includes('supabase.createClient')&&!['supabase-client.js','account-page.js'].includes(entry.name)){
      offenders.push(entry.name);
    }
  }
  assert.deepEqual(offenders,[]);
  const shared=await read('js/supabase-client.js');
  assert.match(shared,/storageKey:\s*['"]sathivo\.auth\.v1['"]/);
  const recovery=await read('js/account-page.js');
  assert.match(recovery,/storageKey:\s*['"]sathivo\.recovery\.v1['"]/);
});

test('all live Edge Function sources are tracked and use the pinned Supabase JS version', async()=>{
  const expected=[
    'push-subscription',
    'send-booking-push',
    'open-view-once-photo',
    'mark-chat-read',
    'admin-dashboard-stats',
    'submit-support',
    'delete-my-account',
    'track-site-visit',
  ];
  for(const slug of expected){
    const file=path.join(root,'supabase','functions',slug,'index.ts');
    await stat(file);
    const source=await readFile(file,'utf8');
    assert.match(source,/npm:@supabase\/supabase-js@2\.116\.0/,slug+' must use the project-pinned Supabase JS version');
  }
});

test('profile publishing requires a photo or built-in avatar', async()=>{
  const source=await read('js/listing-publish.js');
  assert.match(source,/if\(!p\.avatar_path\)throw Error\(/);
  assert.match(source,/isBuiltinAvatar\(p\.avatar_path\)/);
});

test('important schema migrations are tracked in GitHub', async()=>{
  const names=await readdir(path.join(root,'supabase','migrations'));
  for(const suffix of [
    'allow_builtin_profile_avatars.sql',
    'edge_function_rate_limits.sql',
    'expand_pan_india_district_coverage.sql',
    'allow_owner_photo_cleanup.sql',
  ]){
    assert.ok(names.some(name=>name.endsWith(suffix)),suffix+' is missing');
  }
});


test('public Edge Functions keep server-side abuse controls', async()=>{
  const visitor=await read('supabase/functions/track-site-visit/index.ts');
  assert.match(visitor,/site-visit-hour/);
  assert.match(visitor,/site-visit-day/);
  assert.match(visitor,/site-visitor-new-day/);
  assert.match(visitor,/p_limit:5/);
  assert.match(visitor,/originAllowed/);
  assert.match(visitor,/key\.startsWith\("sb_secret_"\)/);
  assert.match(visitor,/headers\.delete\("Authorization"\)/);

  const support=await read('supabase/functions/submit-support/index.ts');
  assert.match(support,/support-hour/);
  assert.match(support,/support-day/);
  assert.match(support,/website/);
  assert.match(support,/originAllowed/);
});


test('ad placements stay in safe test mode until real unit IDs are configured', async()=>{
  const config=await read('js/ads-config.js');
  assert.match(config,/testMode:true/);
  for(const slot of ['home-mid','directory-top','directory-inline','bookings-top','booking-confirm']){
    assert.match(config,new RegExp("'"+slot+"'"));
  }

  const ads=await read('js/ads.js');
  assert.match(ads,/MutationObserver/);
  assert.match(ads,/adsbygoogle/);

  const companions=await read('js/companions-page.js');
  assert.match(companions,/directory-inline/);
  assert.match(companions,/booked=1/);

  const bookings=await read('js/bookings-page.js');
  assert.match(bookings,/booking-confirm/);
  assert.match(bookings,/Booking request sent/);
});


test('profile and chat photos are compressed before upload', async()=>{
  const compressor=await read('js/image-compress.js');
  assert.match(compressor,/maxBytes=480\*1024/);
  assert.match(compressor,/image\/webp/);
  assert.match(compressor,/MAX_SOURCE_PIXELS/);
  assert.match(compressor,/50\*1024\*1024/);

  const chat=await read('js/chat-page.js');
  assert.match(chat,/compressImageFile/);
  assert.match(chat,/maxBytes:480\*1024/);
  assert.doesNotMatch(chat,/Photo must be 5 MB or smaller/);

  const profile=await read('js/profile-page.js');
  assert.match(profile,/compressImageFile/);
  assert.match(profile,/maxBytes:300\*1024/);
  assert.doesNotMatch(profile,/under 5 MB/);
});
