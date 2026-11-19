import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('web-only alerts participate in website badge, list, read and realtime updates',async()=>{
 const header=await read('js/header-notifications.js'),page=await read('js/notifications-page.js');
 for(const src of [header,page])assert.ok(src.includes("'website_notifications'"));
 assert.ok(page.includes("if(link==='index.html')return './';"));
 assert.ok(page.includes("r.source==='website_notifications'?'website_notifications':'notifications'"));
 assert.ok(page.includes("Open Sathivo Home"));
 assert.ok(page.includes("card.addEventListener('click'"));
 assert.ok(header.includes("(website.error?0:website.count||0)"));
});
