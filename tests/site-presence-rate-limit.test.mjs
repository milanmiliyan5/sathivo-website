import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('visitor Presence stays below Supabase per-client five-calls-per-30s limit',async()=>{
  const src=await read('js/site-presence.js');
  assert.match(src,/const presenceWindowMs=30000/);
  assert.match(src,/const presenceBudget=4/);
  assert.match(src,/presenceCalls\.push\(now\)/);
  assert.match(src,/presenceCalls\.length>=presenceBudget/);
  assert.match(src,/const hiddenGraceMs=9000/);
  assert.match(src,/if\(shouldBeOnline===tracked\)return/);
  assert.match(src,/if\(closed\|\|!subscribed\|\|inFlight\)return/);
  assert.match(src,/if\(!event\.persisted\)\{/);
  assert.match(src,/void client\.removeChannel\(channel\)/);
  assert.doesNotMatch(src,/void channel\.untrack\(\)/);
});

test('every public page using visitor Presence loads rate-safe code',async()=>{
  const files=(await readdir(new URL('../',import.meta.url))).filter(f=>f.endsWith('.html'));
  let included=0;
  for(const file of files){
    const src=await read(file);
    assert.doesNotMatch(src,/js\/site-presence\.js\?v=20261025-tracking-1/);
    if(src.includes('js/site-presence.js')){
      included++;
      assert.match(src,/js\/site-presence\.js\?v=20261122-rate-safe-1/);
    }
  }
  assert.ok(included>10,'visitor Presence must remain active on the website');
});
