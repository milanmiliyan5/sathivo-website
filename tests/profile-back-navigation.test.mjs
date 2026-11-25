import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('manual and automatic profile tabs replace a single history entry',async()=>{
 const js=await read('js/profile-page.js');
 const source=js.slice(js.indexOf('function showProfileTab('),js.indexOf('function revealProfileControl('));
 const stack=[{url:'account.html#account',state:null},{url:'profile.html',state:{sathivoProfileTab:'personal'}}];
 const history={get state(){return stack.at(-1).state;},replaceState(state,_title,url){stack[stack.length-1]={url,state};},pushState(){assert.fail('Profile tab created a Back entry');}};
 const context=vm.createContext({history,location:{href:'profile.html'},profileTab:'personal',savedSectionProfile:{},availableProfileTabs:()=>['personal','companion','privacy'],$:()=>({value:'companion',focus(){}}),profileScroll:{cancel(){},reset(){}},document:{querySelectorAll:()=>[]}});
 vm.runInContext(source,context);
 for(const tab of ['companion','privacy','personal','privacy','companion'])vm.runInContext('showProfileTab('+JSON.stringify(tab)+',{record:true,focus:true,resetScroll:true})',context);
 assert.equal(stack.length,2);
 assert.equal(history.state.sathivoProfileTab,'companion');
 stack.pop();
 assert.equal(stack.at(-1).url,'account.html#account');
});
test('legacy same-document Back exits to Account, and header back uses the account route',async()=>{
 const js=await read('js/profile-page.js'),html=await read('profile.html');
 assert.doesNotMatch(js,/history\.pushState/);
 const start=js.indexOf("window.addEventListener('popstate'");
 const end=js.indexOf('// Preserve the current view',start);
 assert.ok(start>=0&&end>start);
 let handler,destination;
 vm.runInNewContext(js.slice(start,end),{window:{addEventListener(name,fn){assert.equal(name,'popstate');handler=fn;}},profileTabs:new Set(['personal','companion','privacy']),profileScroll:{cancel(){}},location:{replace(url){destination=url;}}});
 handler({state:null});
 assert.equal(destination,undefined);
 handler({state:{sathivoProfileTab:'personal'}});
 assert.equal(destination,'account.html#account');
 assert.match(html,/class="profile-account-back" href="account\.html#account"/);
 assert.match(js,/beforeunload/);
});
