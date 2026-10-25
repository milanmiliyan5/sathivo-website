import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getSathivoClient,getSathivoPublicClient} from '../js/supabase-client.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('public Supabase client never restores or persists expired account sessions',async()=>{
 const previous=globalThis.supabase;
 const created=[];
 try{
  globalThis.supabase={createClient:(url,key,opts)=>{
   created.push({url,key,opts});
   return {url,key,opts};
  }};
  const [anonymous,anonymousAgain,loggedIn,loggedInAgain]=await Promise.all([
   getSathivoPublicClient(),getSathivoPublicClient(),getSathivoClient(),getSathivoClient()
  ]);
  assert.equal(anonymous,anonymousAgain);
  assert.equal(loggedIn,loggedInAgain);
  assert.equal(created.length,2);
  assert.equal(anonymous.opts.auth.persistSession,false);
  assert.equal(anonymous.opts.auth.autoRefreshToken,false);
  assert.equal(anonymous.opts.auth.detectSessionInUrl,false);
  assert.notEqual(anonymous.opts.auth.storageKey,loggedIn.opts.auth.storageKey);
  assert.equal(loggedIn.opts.auth.persistSession,true);
  assert.equal(anonymous.key,loggedIn.key);
 }finally{
  if(previous===undefined)delete globalThis.supabase;else globalThis.supabase=previous;
 }
});

test('public directory can initialize filters and profiles without a valid login',async()=>{
 const source=await read('js/companions-page.js');
 const directory=await read('companions.html');
 const detail=await read('companion.html');
 assert.match(source,/getSathivoPublicClient/);
 assert.match(source,/opts\('state',statesAndUTs/);
 assert.match(source,/const \{data,error\}=await publicClient\.from\('profile_locations'\)/);
 assert.match(source,/publicClient\.rpc\('browse_public_companions_v2'/);
 assert.match(source,/publicClient\.rpc\('browse_public_city_suggestions'/);
 assert.match(source,/publicClient\.storage\.from\('listing-photos'\)/);
 assert.match(source,/publicClient\.from\('companion_listings'\)/);
 assert.match(source,/void client\.auth\.getUser\(\)\.then/);
 assert.ok(source.indexOf('setupDirectory();')<source.indexOf('publicClient=await getSathivoPublicClient()'));
 assert.match(source,/\$\('retry'\)\.onclick=\(\)=>void init\(\)/);
 assert.match(source,/if\(!locationsLoaded&&\(\$\('state'\)\.value/);
 assert.match(directory,/js\/companions-page\.js\?v=\d{8}-[a-z0-9-]+/i);
 assert.match(detail,/js\/companions-page\.js\?v=\d{8}-[a-z0-9-]+/i);
});
