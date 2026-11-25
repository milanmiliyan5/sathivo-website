import {getSathivoClient,getSathivoPublicClient} from './supabase-client.js?v=20261025-polish-1';
import {avatarAsset} from './avatar-utils.js?v=20261121-avatars-1';
const $=id=>document.getElementById(id);
const tabs=[...document.querySelectorAll('[data-category]')];
const list=$('tc-list'),status=$('tc-status'),retry=$('tc-retry');
let client,category='active',seq=0;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
function makeRow(row,index,kind){
 const li=node('li'),link=node('a','tc-row');
 link.href='companion.html?id='+encodeURIComponent(row.public_id);
 const rank=node('span','tc-rank'+(index<3?' tc-rank-'+(index+1):''),String(index+1));
 const name=String(row.display_name||'Companion'),avatar=node('span','tc-avatar',Array.from(name.trim())[0]?.toUpperCase()||'♡');
 const showPhoto=src=>{const img=node('img');img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>avatar.replaceChildren(document.createTextNode(Array.from(name.trim())[0]?.toUpperCase()||'♡'));img.src=src;avatar.replaceChildren(img)};
 if(row.photo_path){const builtin=avatarAsset(row.photo_path);if(builtin)showPhoto(builtin);else void client.storage.from('listing-photos').createSignedUrl(row.photo_path,60).then(({data,error})=>{if(!error&&data?.signedUrl&&avatar.isConnected)showPhoto(data.signedUrl)}).catch(()=>{});}
 const metric=node('span','tc-metric');
 const value=kind==='active'?Number(row.points).toLocaleString('en-IN'):kind==='booked'?Number(row.completed_count).toLocaleString('en-IN'):'★ '+Number(row.average_rating).toFixed(1);
 metric.append(node('strong','',value),node('small','',kind==='active'?'Points':kind==='booked'?'Bookings':Number(row.review_count)+' reviews'));
 const arrow=node('span','tc-chevron','›');arrow.setAttribute('aria-hidden','true');
 link.append(rank,avatar,node('span','tc-name',name),metric,arrow);li.append(link);return li;
}
async function load(kind=category){
 category=kind;const request=++seq;
 tabs.forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.category===kind)));
 status.textContent='Loading companions…';retry.hidden=true;list.replaceChildren();list.setAttribute('aria-busy','true');
 try{
  if(!client)throw Error('Connection unavailable');
  const {data,error}=await client.rpc('top_companions_rankings',{p_category:kind});
  if(request!==seq)return;if(error)throw error;
  const rows=Array.isArray(data)?data.slice(0,20):[];
  list.replaceChildren(...rows.map((row,i)=>makeRow(row,i,kind)));
  status.textContent=rows.length?'':kind==='rated'?'No rated companions yet.':kind==='booked'?'No completed bookings yet.':'No active companions yet.';
 }catch{if(request===seq){status.textContent='Could not load rankings. Please try again.';retry.hidden=false;}}
 finally{if(request===seq)list.setAttribute('aria-busy','false');}
}
async function init(){
 try{
  const auth=await getSathivoClient(),{data}=await auth.auth.getSession();
  client=data?.session?auth:await getSathivoPublicClient();
  await load();
  if(data?.session){
   const checkbox=$('tc-opt-out'),prefStatus=$('tc-pref-status');
   const {data:opt,error}=await auth.rpc('top_companions_preference',{p_opt_out:null});
   if(!error){checkbox.checked=opt===true;$('tc-preference').hidden=false;
    checkbox.addEventListener('change',async()=>{
     const wanted=checkbox.checked;checkbox.disabled=true;prefStatus.textContent='';
     try{const {data:actual,error:e}=await auth.rpc('top_companions_preference',{p_opt_out:wanted});if(e)throw e;checkbox.checked=actual===true;prefStatus.textContent='Preference saved.';await load();}
     catch{checkbox.checked=!wanted;prefStatus.textContent='Could not save. Try again.';}finally{checkbox.disabled=false;}
    });
   }
  }
 }catch{status.textContent='Could not connect to Sathivo. Please try again.';retry.hidden=false;list.setAttribute('aria-busy','false');}
}
tabs.forEach(tab=>tab.addEventListener('click',()=>void load(tab.dataset.category)));
retry.addEventListener('click',()=>void(client?load():init()));void init();
