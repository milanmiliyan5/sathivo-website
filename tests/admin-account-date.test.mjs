import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {todayAccounts} from '../js/admin-account-date.js';

test('daily accounts use IST midnight and include signup-only users',()=>{
  const rows=[
    {id:'old',joined_at:'2026-11-14T18:29:59Z'},
    {id:'first',joined_at:'2026-11-14T18:30:00Z',has_profile:false},
    {id:'last',joined_at:'2026-11-15T18:29:59Z',has_profile:true},
    {id:'next',joined_at:'2026-11-15T18:30:00Z'},
    {id:'bad',joined_at:'invalid'},{id:'none',joined_at:null}
  ];
  assert.deepEqual(todayAccounts(rows,new Date('2026-11-15T12:00:00Z')).map(x=>x.id),['first','last']);
  assert.deepEqual(todayAccounts(rows,new Date('2026-11-15T18:30:01Z')).map(x=>x.id),['next']);
  assert.deepEqual(todayAccounts([],new Date('2026-11-15T12:00:00Z')),[]);
});
test('daily card opens date-filtered admin users using the manually refreshed signup list',async()=>{
  const html=await readFile(new URL('../admin.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../js/admin-page.js',import.meta.url),'utf8');
  assert.match(html,/id="today-accounts-card"/);
  assert.match(html,/id="metric-accounts-today"/);
  assert.match(html,/id="user-date-filter"/);
  assert.match(js,/client\.functions\.invoke\('admin-users-list'\)/);
  assert.doesNotMatch(js,/setInterval\(|refreshLiveMetrics|refreshRegisteredUsers|metricsTimer/);
  assert.match(js,/\$\('refresh-dashboard'\)\.addEventListener\('click',\(\)=>void refreshAll\(true\)\)/);
  assert.match(js,/await refreshAll\(true\);startPresence\(\)/);
  assert.match(js,/Manual refresh/);
  assert.match(js,/\.on\('presence',\{event:'sync'\},updateOnline\)/);
  assert.match(js,/\$\('user-date-filter'\)\.value='today'/);
  assert.match(js,/registeredUsersAvailable=users!==null/);
  assert.match(js,/if\(todays===null\)/);
});
