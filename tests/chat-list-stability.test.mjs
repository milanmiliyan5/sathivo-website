import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const source=await read('js/chats-page.js');
test('Chats feedback is below the list and entrance animation is disabled only on this page',async()=>{
 const html=await read('chats.html'),css=await read('chats-compact.css');
 assert.ok(html.indexOf('id="chats"')<html.indexOf('id="status"'));
 assert.ok(html.indexOf('id="chats"')<html.indexOf('id="chats-retry"'));
 assert.doesNotMatch(html,/src="js\/site-motion\.js/);
 assert.match(css,/transform:none!important;animation:none!important;transition:none!important/);
 assert.match(css,/#chats-retry\[hidden\]\{\s*display:none!important/);
 assert.match(html,/stable-inbox-1/);
});
class Node{
 constructor(kind='div'){this.kind=kind;this.children=[];this.dataset={};this.parent=null;this.className='';this.textContent='';this.classList={add:s=>{this.className+=' '+s}};}
 append(...items){for(const n of items)this.insertBefore(n,null)}
 insertBefore(n,b){if(n.parent)n.remove();const i=b?this.children.indexOf(b):this.children.length;this.children.splice(i,0,n);n.parent=this;}
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null}}
 replaceWith(n){const p=this.parent;p.insertBefore(n,this);this.remove()}
 querySelector(s){const matches=n=>s.startsWith('.')?n.className.split(' ').includes(s.slice(1)):n.kind===s;for(const child of this.children){if(matches(child))return child;const nested=child.querySelector(s);if(nested)return nested}return null}
}
function setup(){
 const list=new Node(),avatarCalls=[];
 const ctx=vm.createContext({$:()=>list,client:{},avatarCheckedAt:new WeakMap(),showChatAvatars:(c,contacts)=>avatarCalls.push(contacts),document:{createElement:t=>new Node(t)}});
 vm.runInContext(source.slice(source.indexOf('const el='),source.indexOf('function skeletons()')),ctx);
 return {ctx,list,avatarCalls};
}
const first={booking_id:'a',other_user_id:'one',other_display_name:'A',last_message:'Hi',category:'Coffee',booking_status:'accepted',unread_count:0};
test('unchanged live refresh keeps the exact row, content and avatar nodes',()=>{
 const {ctx,list,avatarCalls}=setup();
 ctx.reconcileCards([first]);const a=list.children[0],main=a.querySelector('.chat-list-main'),avatar=a.querySelector('.chat-list-avatar');
 ctx.reconcileCards([{...first}]);
 assert.equal(list.children[0],a);assert.equal(a.querySelector('.chat-list-main'),main);assert.equal(a.querySelector('.chat-list-avatar'),avatar);
 assert.equal(avatarCalls.length,1);
});
test('new messages update existing row, keep avatar, and reorder only when necessary',()=>{
 const {ctx,list}=setup();const second={...first,booking_id:'b',other_user_id:'two',other_display_name:'B'};
 ctx.reconcileCards([first,second]);const [a,b]=list.children;const avatar=a.querySelector('.chat-list-avatar');
 ctx.reconcileCards([second,{...first,last_message:'New',unread_count:2}]);
 assert.equal(list.children[0],b);assert.equal(list.children[1],a);assert.equal(a.querySelector('.chat-list-avatar'),avatar);
 assert.equal(a.querySelector('.chat-list-preview').textContent,'New');
 assert.equal(a.querySelector('.chat-unread-count').textContent,'2');
 ctx.reconcileCards([second]);assert.deepEqual(list.children,[b]);
});
test('realtime loading cannot overlap and successful refresh hides stale retry',async()=>{
 const status={},retry={hidden:true},list={querySelector:()=>true,replaceChildren(){}},empty={};let resolve,requests=0,rendered=0,trailing=0;
 const ctx=vm.createContext({client:{rpc(){requests++;return new Promise(r=>{resolve=r})}},user:{id:'u'},disposed:false,loading:false,refreshPending:false,loadSequence:0,hasLoaded:true,chatRows:[],$:id=>({'status':status,'chats-retry':retry,'chats':list,'empty':empty})[id],withCurrentBookingNames:async(c,r)=>r,renderChats:()=>rendered++,scheduleRefresh:()=>trailing++});
 vm.runInContext(source.slice(source.indexOf('async function load(){'),source.indexOf('function scheduleRefresh(){')),ctx);
 const pending=ctx.load();await ctx.load();assert.equal(requests,1);
 resolve({error:new Error('offline')});await pending;assert.equal(retry.hidden,false);assert.equal(rendered,0);assert.equal(trailing,1);
 const next=ctx.load();resolve({data:[first]});await next;assert.equal(retry.hidden,true);assert.equal(status.textContent,'');assert.equal(rendered,1);
});
