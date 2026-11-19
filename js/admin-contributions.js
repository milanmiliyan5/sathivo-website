const $=id=>document.getElementById(id);
const currency=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n||0)/100);
let running=null;
export function initContributions(client){$('contribution-admin-refresh')?.addEventListener('click',()=>void refreshContributions(client))}
export function refreshContributions(client){
 if(running)return running;
 running=(async()=>{const status=$('contribution-admin-status');if(!status)return;
 try{status.textContent='Loading verified contribution records…';const {data,error}=await client.functions.invoke('sathivo-contribution-checkout',{body:{action:'admin'}});if(error||!data)throw Error('Unavailable');
 for(const [id,key] of [['contribution-total','total_paise'],['contribution-today','today_paise'],['contribution-month','month_paise']])$(id).textContent=currency(data[key]);
 $('contribution-captured').textContent=String(data.captured_count||0);$('contribution-failed').textContent=String(data.failed_count||0);
 const tbody=$('contribution-history');tbody.replaceChildren();for(const r of data.recent||[]){const tr=document.createElement('tr');for(const val of [new Date(r.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}),r.user_id||'Deleted account',currency(r.amount_paise),currency(r.refunded_paise),r.status,r.payment_id||r.provider_order_id||'—']){const cell=document.createElement('td');cell.textContent=val;tr.append(cell)}tbody.append(tr)}
 if(!tbody.children.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No contribution orders yet.';tr.append(td);tbody.append(tr)}
 status.textContent=(data.checkout_enabled?'Live checkout enabled.':'Live checkout locked pending approval.')+' '+(data.provider_configured?'Credential names configured.':'Razorpay credentials need checking.');
 }catch{status.textContent='Contribution records unavailable. Refresh to retry.'}
 })().finally(()=>{running=null});return running;
}