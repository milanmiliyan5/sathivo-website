import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('phase two controls preserve existing activity and payment settlement',async()=>{
 const sql=await read('supabase/migrations/20261126035212_founder_controls_phase_two.sql');
 const follow=await read('supabase/migrations/20261126035227_founder_preserve_existing_upserts.sql');
 assert.match(sql,/founder_member_restrictions enable row level security/);assert.match(sql,/founder_member_notices enable row level security/);
 assert.match(sql,/Admin accounts cannot be restricted/);assert.match(sql,/new_contributions/);assert.match(sql,/reserve_contribution_order/);
 assert.match(sql,/insert into public.notifications/);assert.match(sql,/before insert on public.booking_messages/);
 assert.match(follow,/Existing profile upserts/);assert.match(follow,/where user_id=new.user_id and published/);
});
test('member actions require confirmation and show exact scope',async()=>{
 const [module,page,html]=await Promise.all([read('js/founder-controls.js'),read('js/admin-page.js'),read('admin.html')]);
 assert.match(module,/Restrict activity/);assert.match(module,/Restore activity/);assert.match(module,/Send account notice/);
 assert.match(module,/window.confirm/);assert.match(module,/founder_member_notices/);assert.match(page,/founder.attachMember/);assert.match(html,/founder-member-actions/);
});
