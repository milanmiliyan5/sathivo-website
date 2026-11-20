import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {avatarOptions,avatarAsset,avatarMarker} from '../js/avatar-utils.js';
test('all nine built-in avatars retain stable IDs and resolve locally',async()=>{
 const ids=['male-1','male-2','male-3','female-1','female-2','female-3','female-niqab','female-modern','female-fashionable'];
 assert.deepEqual(avatarOptions.map(a=>a.id),ids);
 for(const id of ids){
  const path=avatarAsset(avatarMarker(id));
  assert.ok(path);
  const image=await readFile(new URL('../'+path.split('?')[0],import.meta.url));
  assert.equal(image.toString('ascii',0,4),'RIFF');
  assert.equal(image.toString('ascii',8,12),'WEBP');
  if(id.startsWith('female-')&&!/\\d$/.test(id))assert.ok(image.length<10000);
 }
 assert.equal(avatarAsset('builtin:unknown'),null);
 assert.equal(avatarAsset('https://example.com/photo.webp'),null);
});
test('both database constraints contain all approved built-in markers',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261120200001_allow_three_additional_builtin_avatars.sql',import.meta.url),'utf8');
 for(const {id} of avatarOptions)assert.equal(sql.split("'builtin:"+id+"'").length-1,2);
 assert.match(sql,/avatar_path = \(user_id::text \|\| '\/avatar\.webp'\)/);
 assert.match(sql,/photo_path = \(user_id::text \|\| '\/avatar\.webp'\)/);
});
