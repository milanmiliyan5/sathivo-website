import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('index.html'),source=await read('js/launch-splash.js'),entry=await read('js/home-entry.js');
const preflight=html.match(/<script id="sathivo-entry-preflight">([\s\S]*?)<\/script>/)[1];
function runPreflight(url,referrer='',stored=false){
 const classes=new Set();
 const root={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};
 vm.runInNewContext(preflight,{URL,location:{href:url},document:{documentElement:root,referrer},localStorage:{getItem:()=>stored?'session':null},window:{setTimeout(){},addEventListener(){}}});
 return classes;
}
test('new visitors get Home splash; stored login gets routed splash; internal Home never redirects',()=>{
 assert.deepEqual([...runPreflight('https://sathivo.co/')],['sathivo-entry-launch']);
 assert.deepEqual([...runPreflight('https://sathivo.co/','',true)],['sathivo-entry-launch','sathivo-entry-pending']);
 assert.equal(runPreflight('https://sathivo.co/?view=home','',true).size,0);
 assert.equal(runPreflight('https://sathivo.co/','https://sathivo.co/chats.html',true).size,0);
});
function runSplash({external=false,pending=false,path='/',seen=true,handoff=null,now=2000}={}){
 const values=new Map();if(seen)values.set('sathivo.launch-splash.seen.v1','1');
 if(handoff)values.set('sathivo.launch-splash.handoff.v1',JSON.stringify(handoff));
 const screens=[],timers=[],styles={};const root={classList:{contains:x=>x==='sathivo-entry-launch'?external:x==='sathivo-entry-pending'?pending:false}};
 const win={matchMedia:()=>({matches:false}),addEventListener(){}};
 const screen={style:{setProperty:(k,v)=>styles[k]=v},addEventListener(){},remove(){}};
 vm.runInNewContext(source,{window:win,document:{documentElement:root,body:{prepend:n=>screens.push(n)},createElement:()=>screen},location:{pathname:path},sessionStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},Date:{now:()=>now},MutationObserver:class{observe(){} disconnect(){}},setTimeout:(fn,ms)=>{timers.push(ms);return 1},clearTimeout(){}});
 return {screens,timers,styles,values,win};
}
test('returning root overrides seen flag and holds the original artwork during routing',()=>{
 const result=runSplash({external:true,pending:true});
 assert.equal(result.screens.length,1);assert.equal(result.timers.length,0);
 assert.equal(result.win.__sathivoEntrySplashStartedAt,2000);
 assert.match(result.screens[0].innerHTML,/Find your kind of company/);
 assert.equal(runSplash({path:'/chats.html'}).screens.length,0);
});
test('Explore consumes one fresh handoff and resumes the branded fade',()=>{
 const result=runSplash({path:'/companions.html',handoff:{path:'/companions.html',started:1000,issued:1700}});
 assert.equal(result.screens.length,1);
 assert.equal(result.styles['--sathivo-splash-elapsed'],'1000ms');
 assert.equal(result.values.has('sathivo.launch-splash.handoff.v1'),false);
 assert.equal(runSplash({path:'/chats.html',handoff:{path:'/companions.html',started:1000,issued:1700}}).screens.length,0);
 assert.equal(runSplash({path:'/companions.html',now:20000,handoff:{path:'/companions.html',started:1000,issued:1700}}).screens.length,0);
});
test('routing retains validated identity and incomplete profile setup; no alternate Continue screen',async()=>{
 assert.match(entry,/client\.auth\.getUser\(\)/);
 assert.match(entry,/profileReady\(data\)\?'companions\.html':'profile\.html'/);
 assert.match(entry,/if\(destination&&pending\(\)\)/);
 assert.match(entry,/sessionStorage\.setItem\('sathivo\.launch-splash\.handoff\.v1'/);
 assert.doesNotMatch(html,/Continue to Home/);
 assert.match(html,/body>:not\(\.sathivo-launch-screen\):not\(#sathivo-entry-loader\)/);
 for(const p of ['index.html','companions.html','profile.html']){
  assert.match(await read(p),/js\/launch-splash\.js\?v=20261125-entry-handoff-1/);
 }
});
