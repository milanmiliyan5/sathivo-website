// Manual scans only. No timers or user-data mutations.
export const checklist=[
 ['Admin automatic refresh','Optimized','Manual dashboard refresh; Online Now stays live.'],
 ['Duplicate database requests','Partial','Admin requests are coalesced. Other pages need review.'],
 ['Background API requests','Android build ready','Polling reduced in the optimized APK; installed versions may differ.'],
 ['Repeated chat count requests','Review required','Website header optimization not yet completed.'],
 ['Log query usage','Provider metric','Check Supabase usage. Billing quota cannot be cleared here.'],
 ['Realtime connections','Review required','Database connection count is not a count of duplicate Realtime subscriptions.'],
 ['Image compression','Website enabled','New profile and chat photos already use compression. Existing photos are untouched.'],
 ['Image caching','Review required','Private photos must not be cached indiscriminately.'],
 ['Unnecessary data fetching','Review required','Requires code audit; not a storage bucket.'],
 ['Pagination','Review required','Requires code changes and regression tests.']
];
export const canClean=data=>Number.isInteger(data?.rate_limit_expired)&&data.rate_limit_expired>0;
export function initMaintenance(client,adminId){
 const $=id=>document.getElementById(id),scan=$('maintenance-scan'),clean=$('maintenance-clean'),status=$('maintenance-status');
 const historyKey='sathivo.admin.maintenance.history.v1:'+adminId;
 let busy=false,last=null;
 const nf=new Intl.NumberFormat('en-IN');
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n};
 const time=v=>new Date(v).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST';
 const readHistory=()=>{try{const v=JSON.parse(localStorage.getItem(historyKey)||'[]');return Array.isArray(v)?v.filter(x=>Number.isInteger(x?.removed)&&x.removed>=0&&Number.isFinite(Date.parse(x.at))).slice(0,10):[]}catch{return []}};
 let history=readHistory();
 function renderHistory(){
  $('maintenance-history').replaceChildren(...(history.length?history.map(x=>node('div',time(x.at)+' · '+nf.format(x.removed)+' expired counters removed')):[node('div','No cleanup recorded in this browser.')]));
 }
 function render(data){
  $('maintenance-db').textContent=(Number(data.database_bytes)/1048576).toFixed(2)+' MB';
  $('maintenance-connections').textContent=nf.format(data.connections)+' / '+nf.format(data.max_connections);
  $('maintenance-connections').dataset.warning=String(Number(data.max_connections)>0&&Number(data.connections)/Number(data.max_connections)>=.8);
  $('maintenance-expired').textContent=nf.format(data.rate_limit_expired);
  $('maintenance-expired').dataset.warning=String(canClean(data));
  $('maintenance-counter-detail').textContent=nf.format(data.rate_limit_total)+' total · older than 30 days eligible';
 }
 for(const [title,state,detail] of checklist){const row=node('article','');row.className='maintenance-item';row.append(node('strong',title),node('b',state),node('span',detail));$('maintenance-checklist').append(row)}
 renderHistory();
 async function run(action){
  if(busy)return;
  if(action==='cleanup'&&(!canClean(last)||!window.confirm('Remove only expired temporary rate-limit counters older than 30 days? No user records or active security limits will be removed.')))return;
  busy=true;scan.disabled=true;clean.disabled=true;
  status.textContent=action==='scan'?'Scanning system…':'Removing expired temporary counters…';
  try{
   const {data,error}=await client.functions.invoke('admin-maintenance',{body:{action,confirmed:action==='cleanup'}});
   if(error||!Number.isInteger(data?.rate_limit_expired)||!Number.isFinite(data?.database_bytes)||!Number.isFinite(Date.parse(data?.scanned_at)))throw Error('Maintenance request failed');
   last=data;render(data);
   if(action==='cleanup'){
    history=[{at:data.scanned_at,removed:data.removed},...history].slice(0,10);
    let saved=true;try{localStorage.setItem(historyKey,JSON.stringify(history))}catch{saved=false}
    renderHistory();
    status.textContent=nf.format(data.removed)+' expired counters removed. '+nf.format(data.rate_limit_expired)+' still eligible. '+(saved?'':'History is available only until this page closes. ')+'User records unchanged.';
   }else status.textContent='Scanned '+time(data.scanned_at)+' · '+(canClean(data)?'Expired temporary counters found. Safe Cleanup available.':'No expired temporary counters found.');
  }catch{last=null;status.textContent='Could not confirm the operation. Scan again before retrying.'}
  finally{busy=false;scan.disabled=false;clean.disabled=!canClean(last)}
 }
 scan.addEventListener('click',()=>void run('scan'));
 clean.addEventListener('click',()=>void run('cleanup'));
}
