import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withCurrentBookingNames } from '../js/booking-name-sync.js';

test('profile name is authoritative across account, listing, and auth metadata', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/20261030010000_unified_display_name_web_android.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /sathivo_display_name_member_sync/);
  assert.match(sql, /sathivo_display_name_auth_sync/);
  assert.match(sql, /sathivo_display_name_listing_sync/);
  assert.match(sql, /SET display_name = v_name/);
  assert.match(sql, /raw_user_meta_data\s*=\s*pg_catalog\.jsonb_set/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
});

test('website account reads the saved canonical name instead of only signup metadata', async () => {
  const script = await readFile(new URL('../js/account-page.js', import.meta.url), 'utf8');
  assert.match(script, /\.select\('profile_kind,display_name'\)/);
  assert.match(script, /account-name'\)\.textContent = latestName/);
});

test('booking and chat display latest names without modifying booking records', async () => {
  const original = [
    { id: 'booking-1', customer_display_name: 'Old customer', companion_display_name: 'Old companion' },
    { booking_id: 'booking-1', other_user_id: 'companion-1', other_display_name: 'Old companion' },
  ];
  const client = { rpc: async (name, params) => {
    assert.equal(name, 'sathivo_booking_names');
    assert.deepEqual(params.p_booking_ids, ['booking-1']);
    return { data: [{
      booking_id: 'booking-1',
      customer_id: 'customer-1',
      companion_id: 'companion-1',
      customer_display_name: 'Dipu Panda',
      companion_display_name: 'Updated Companion',
    }], error: null };
  } };
  const result = await withCurrentBookingNames(client, original);
  assert.equal(result[0].customer_display_name, 'Dipu Panda');
  assert.equal(result[0].companion_display_name, 'Updated Companion');
  assert.equal(result[1].other_display_name, 'Updated Companion');
  assert.equal(original[0].customer_display_name, 'Old customer');
  assert.equal(original[1].other_display_name, 'Old companion');
});

test('offline lookup leaves already authorized records unchanged', async () => {
  const original = [{ id: 'booking-2', customer_display_name: 'Saved name' }];
  const result = await withCurrentBookingNames({ rpc: async () => ({ error: { message: 'offline' } }) }, original);
  assert.equal(result, original);
});

test('live booking name RPC never returns unrelated private booking participants', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/20261030011000_secure_live_booking_name_lookup.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /b\.customer_id=auth\.uid\(\) OR b\.companion_id=auth\.uid\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION.*FROM PUBLIC/);
  assert.match(sql, /GRANT EXECUTE.*TO authenticated/);
});
