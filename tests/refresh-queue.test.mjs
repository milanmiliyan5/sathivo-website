import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {createRefreshQueue} from '../js/refresh-queue.js';

test('twenty realtime events coalesce to one request',async()=>{
 let calls=0;const q=createRefreshQueue(async()=>{calls++},{delay:1});
 for(let i=0;i<20;i++)q.request();
 await sleep(30);assert.equal(calls,1);q.stop();
});
test('events during a request cause one trailing refresh without overlap',async()=>{
 let calls=0,concurrent=0,peak=0,release;
 const q=createRefreshQueue(async()=>{calls++;peak=Math.max(peak,++concurrent);if(calls===1)await new Promise(r=>{release=r});concurrent--},{delay:1});
 q.request();await sleep(20);assert.equal(calls,1);
 for(let i=0;i<20;i++)q.request();
 release();await sleep(30);assert.equal(calls,2);assert.equal(peak,1);q.stop();
});
test('pagehide cancels queued work and pageshow can restart',async()=>{
 let calls=0;const q=createRefreshQueue(async()=>{calls++},{delay:1});
 q.request();q.stop();await sleep(20);assert.equal(calls,0);
 q.start();await sleep(20);assert.equal(calls,1);q.stop();
});
test('a rejected request is handled and later events still work',async()=>{
 let calls=0,errors=0;const q=createRefreshQueue(async()=>{if(++calls===1)throw Error('offline')},{delay:1,onError:()=>errors++});
 q.request();await sleep(20);q.request();await sleep(20);
 assert.equal(errors,1);assert.equal(calls,2);q.stop();
});
