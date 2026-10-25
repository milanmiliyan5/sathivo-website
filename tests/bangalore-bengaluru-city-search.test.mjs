import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = name => readFile(new URL('../' + name, import.meta.url), 'utf8');

test('Bangalore and Bengaluru are aliases in published public companion search', async () => {
  const sql = await read('supabase/migrations/20261026100000_bangalore_bengaluru_city_search_alias.sql');
  assert.match(sql, /create or replace function public\.browse_public_companions_v2/);
  assert.match(sql, /lower\(btrim\(l\.city_name\)\) in \('bangalore','bengaluru'\)/);
  assert.match(sql, /lower\(btrim\(p_city\)\) in \('bangalore','bengaluru'\)/);
  assert.match(sql, /or lower\(btrim\(l\.city_name\)\) = lower\(btrim\(p_city\)\)/);
  assert.match(sql, /l\.published/);
  assert.match(sql, /l\.moderation_status = 'active'/);
  assert.match(sql, /security invoker/);
  assert.doesNotMatch(sql, /\bupdate\s+public\.(?:companion_listings|member_profiles)\b/i);
});

test('location suggestions merge Bangalore/Bengaluru under a readable name', async () => {
  const sql = await read('supabase/migrations/20261026100000_bangalore_bengaluru_city_search_alias.sql');
  const js = await read('js/companions-page.js');
  assert.match(sql, /create or replace function public\.browse_public_city_suggestions/);
  assert.match(sql, /then 'Bengaluru'/);
  assert.match(sql, /then 'bengaluru'/);
  assert.match(js, /'Bengaluru \(Bangalore\)'/);
  assert.match(js, /browse_public_city_suggestions/);
  assert.match(js, /browse_public_companions_v2/);
});
