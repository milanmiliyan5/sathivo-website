import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Requests hub keeps all five menu labels without redundant subtitles',async()=>{
 const html=await readFile(new URL('../requests.html',import.meta.url),'utf8');
 const names=[...html.matchAll(/<span class="request-hub-copy"><span class="request-hub-name">([^<]+)<\/span><\/span>/g)].map(m=>m[1]);
 assert.deepEqual(names,['Sent Requests','Received Requests','Ongoing','Completed','Cancelled']);
 assert.doesNotMatch(html,/class="request-hub-desc"/);
 assert.match(html,/id="request-empty-description"/);
});
