import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('single header bell retains a distinct Requests route and accessible fallback',async()=>{
 const notifications=await readFile(new URL('../js/header-notifications.js',import.meta.url),'utf8');
 const requests=await readFile(new URL('../js/header-requests.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../responsive.css',import.meta.url),'utf8');
 assert.match(notifications,/if\(previous\)return previous/);
 assert.match(notifications,/a\.classList\.add\('notification-header-replaced'\)/);
 assert.match(notifications,/a\.hidden=true/);
 assert.match(notifications,/toggle\.before\(link\);else host\.append\(link\)/);
 assert.match(notifications,/!link\.classList\.contains\('notification-shortcut'\)/);
 assert.match(requests,/host\.querySelector\('a\[href="requests\.html"\]'\)/);
 assert.doesNotMatch(requests,/M18 8a6 6/);
 assert.match(css,/notification-header-replaced\[hidden\]\{display:none!important\}/);
 assert.match(css,/grid-row:1;grid-column:2/);
});
