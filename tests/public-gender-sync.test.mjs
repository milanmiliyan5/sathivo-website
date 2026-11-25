import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Public gender follows saved profile without revealing hidden gender',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261125134518_sync_visible_gender_from_saved_profile.sql',import.meta.url),'utf8');
 assert.ok(sql.includes('after update of gender on public.member_profiles'));
 assert.ok(sql.includes('before insert or update of public_gender on public.companion_listings'));
 assert.ok(sql.includes('l.public_gender is not null'));
 assert.ok(sql.includes('if new.public_gender is not null then'));
 assert.ok(sql.includes("when new.gender in ('male','female','other') then new.gender else null"));
 assert.ok(sql.includes('revoke all on function private.sathivo_sync_visible_gender_from_member() from public,anon,authenticated'));
});
