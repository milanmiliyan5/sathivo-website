import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {createRefreshQueue} from '../js/refresh-queue.js';

test('header scopes refreshes by event and restores a single channel after Back',async()=>{
 const handlers={},channels=[];let notices=0,chats=0,removed=0;
 const client={auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},
  from(){return {select(){return this},eq(){return this},async is(){notices++;return {count:2}}}},
  rpc:async()=>{chats++;return {data:3}},
  channel(name){const c={name,events:[],on(type,filter,fn){this.events.push({filter,fn});return this},subscribe(fn){fn('SUBSCRIBED');return this}};channels.push(c);return c},
  async removeChannel(){removed++}
 };
 const context={getSathivoClient:async()=>client,createRefreshQueue:task=>createRefreshQueue(task,{delay:1}),
  document:{hidden:false,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(n,f)=>{handlers[n]=f}},
  window:{addEventListener:(n,f)=>{handlers[n]=f}}};
 let source=await readFile(new URL('../js/header-notifications.js',import.meta.url),'utf8');
 source=source.replace(/^import .*;\n/gm,'');
 vm.runInNewContext(source,context);
 await sleep(30);assert.equal(channels.length,1);assert.equal(notices,2);assert.equal(chats,1);
 const message=channels[0].events.find(e=>e.filter.table==='booking_messages');
 for(let i=0;i<20;i++)message.fn();await sleep(30);
 assert.equal(chats,2);assert.equal(notices,2,'chat events must not query notifications');
 handlers.pagehide();assert.equal(removed,1);
 handlers.pageshow();handlers.pageshow();await sleep(30);
 assert.equal(channels.length,2,'Back creates exactly one replacement subscription');
 assert.equal(notices,4);assert.equal(chats,3);
 const website=channels[1].events.find(e=>e.filter.table==='website_notifications');
 assert.ok(website);assert.equal(website.filter.filter,'user_id=eq.test-user');
 for(let i=0;i<20;i++)website.fn();await sleep(30);
 assert.equal(notices,6);assert.equal(chats,3,'website notices must not query chats');handlers.pagehide();
});
