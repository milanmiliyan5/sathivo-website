import {assertVersionedAsset} from './versioned-asset.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePhoto,encodedPhotoType,compressImageFile} from '../js/image-compress.js';
import {readFile} from 'node:fs/promises';
const webp=()=>new Blob([new Uint8Array([82,73,70,70,4,0,0,0,87,69,66,80])],{type:'image/webp'});
const jpeg=()=>new Blob([new Uint8Array([255,216,255,224,0,0,0,0,0,0,0,0])],{type:'image/jpeg'});
const png=()=>new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],{type:'image/png'});
test('WebP encoder preserves true WebP',async()=>{
 const out=await encodePhoto({toBlob(cb,type){assert.equal(type,'image/webp');cb(webp());}},.8);
 assert.equal(out.type,'image/webp');assert.equal(out.ext,'webp');
});
test('Safari PNG canvas fallback uses compressed JPEG and reports the correct MIME',async()=>{
 const requested=[];
 const out=await encodePhoto({toBlob(cb,type){requested.push(type);cb(type==='image/webp'?png():jpeg());}},.8);
 assert.deepEqual(requested,['image/webp','image/jpeg']);
 assert.equal(out.type,'image/jpeg');assert.equal(out.ext,'jpg');assert.equal(out.blob.type,'image/jpeg');
 assert.equal(await encodedPhotoType(out.blob),'image/jpeg');
});
test('reject unexpected encoder bytes; detect actual downloaded photo despite legacy filename or metadata',async()=>{
 await assert.rejects(encodePhoto({toBlob(cb){cb(png());}},.8),/not supported/);
 assert.equal(await encodedPhotoType(png()),null);
 assert.equal(await encodedPhotoType(jpeg().slice(0,12,'image/webp')),'image/jpeg');
});
test('profile and public listing preserve legacy keys and actual MIME, with cache versions refreshed',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const [profile,publish,chat,html]=await Promise.all(['js/profile-page.js','js/listing-publish.js','js/chat-page.js','profile.html'].map(read));
 assert.ok(profile.includes("user.id+'/avatar.webp'"));assert.ok(profile.includes('contentType:preparedPhoto.type'));
 assert.ok(publish.includes('await encodedPhotoType(blob)'));assert.ok(publish.includes('contentType:type'));
 assert.ok(chat.includes("prepared.ext"));assertVersionedAsset(html, 'js/profile-page.js', '20261126');
 assertVersionedAsset(profile, './image-compress.js', '20261126');
});
