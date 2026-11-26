const $=id=>document.getElementById(id);
const reasons=Object.freeze({no_companions:"Couldn't find suitable companions",no_responses:"Didn't receive responses",not_interested:"Not interested anymore",technical:"Technical issues",privacy_safety:"Privacy or safety concerns",other:"Other reason",not_provided:"Not provided"});
const kinds={customer:'Customer',companion:'Companion',both:'Both',not_set:'Not set',unknown:'Unknown'};
const dateKey=stamp=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(stamp));
const dateLabel=stamp=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(stamp));
const el=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};
let enabled=false,rows=[],page=0;const PAGE=25;
export function csvCell(value){let s=String(value??'');if(/^[\s\uFEFF]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
function exportCSV(){
 const header=['Deleted (IST)','Account type','Account age (days)','Reason','Optional feedback'];
 const lines=[header,...rows.map(r=>[dateLabel(r.deleted_at),kinds[r.account_kind]||'Unknown',r.account_age_days??'',reasons[r.reason]||'Not provided',r.feedback||''])];
 const blob=new Blob([lines.map(line=>line.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='sathivo-account-deletions.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function table(){
 const start=page*PAGE,visible=rows.slice(start,start+PAGE),body=$('deletions-body');body.replaceChildren();
 if(!visible.length){const tr=el('tr'),td=el('td','No completed deletions recorded yet.');td.colSpan=5;tr.append(td);body.append(tr);}
 for(const r of visible){const tr=el('tr');for(const value of [dateLabel(r.deleted_at),kinds[r.account_kind]||'Unknown',r.account_age_days===null?'Unknown':r.account_age_days+' days',reasons[r.reason]||'Not provided',r.feedback||'—'])tr.append(el('td',value));body.append(tr);}
 $('deletions-pager').hidden=rows.length<=PAGE;$('deletions-prev').disabled=page===0;$('deletions-next').disabled=start+PAGE>=rows.length;
 $('deletions-page').textContent=rows.length?(start+1)+'–'+Math.min(start+PAGE,rows.length)+' of '+rows.length:'0';
}
function bars(id,labels,counts){
 const root=$(id),max=Math.max(1,...counts);root.replaceChildren();
 for(let i=0;i<labels.length;i++){const b=el('span',undefined,'deletion-bar');b.style.height=Math.max(2,Math.round(counts[i]/max*100))+'px';b.title=labels[i]+': '+counts[i];b.setAttribute('aria-label',b.title);root.append(b);}
 root.setAttribute('aria-label',labels.map((l,i)=>l+': '+counts[i]).join('; '));
}
function render(){
 const today=dateKey(Date.now()),month=today.slice(0,7),dayCounts=new Map(),monthCounts=new Map(),reasonCounts=new Map();
 for(const r of rows){const day=dateKey(r.deleted_at),m=day.slice(0,7);dayCounts.set(day,(dayCounts.get(day)||0)+1);monthCounts.set(m,(monthCounts.get(m)||0)+1);reasonCounts.set(r.reason,(reasonCounts.get(r.reason)||0)+1);}
 $('deletions-today').textContent=dayCounts.get(today)||0;$('deletions-month').textContent=monthCounts.get(month)||0;$('deletions-total').textContent=rows.length;
 const root=$('deletions-reasons');root.replaceChildren();const max=Math.max(1,...reasonCounts.values());
 for(const [key,label] of Object.entries(reasons).sort((a,b)=>(reasonCounts.get(b[0])||0)-(reasonCounts.get(a[0])||0))){const n=reasonCounts.get(key)||0,line=el('div',undefined,'deletion-reason-line');line.append(el('span',label),el('strong',n));const track=el('div',undefined,'deletion-track'),fill=el('span',undefined,'deletion-fill');fill.style.width=n/max*100+'%';track.append(fill);root.append(line,track);}
 const days=Array.from({length:30},(_,i)=>dateKey(Date.now()-(29-i)*86400000));bars('deletions-days',days,days.map(d=>dayCounts.get(d)||0));
 const [y,m]=month.split('-').map(Number),months=Array.from({length:6},(_,i)=>new Date(Date.UTC(y,m-6+i,1)).toISOString().slice(0,7));bars('deletions-months',months,months.map(m=>monthCounts.get(m)||0));
 page=0;table();$('deletions-export').disabled=!rows.length;
}
export function initDeletions(){
 enabled=true;$('deletions-nav').hidden=false;$('deletions-section').hidden=false;
 $('deletions-export').onclick=exportCSV;$('deletions-prev').onclick=()=>{if(page>0){page--;table();}};$('deletions-next').onclick=()=>{if((page+1)*PAGE<rows.length){page++;table();}};
}
export async function refreshDeletions(client){
 if(!enabled)return true;
 const status=$('deletions-status');status.textContent='Loading deletion records…';$('deletions-export').disabled=true;
 try{
  const next=[];const cutoff=new Date().toISOString();
  for(let offset=0;;offset+=500){const {data,error}=await client.from('account_deletion_events').select('id,deleted_at,account_kind,account_age_days,reason,feedback').lte('deleted_at',cutoff).order('deleted_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+499);if(error)throw error;next.push(...(data||[]));if(!data||data.length<500)break;}
  rows=next;render();status.textContent='Updated · '+rows.length+' recorded deletions. Refresh All to update.';return true;
 }catch{status.textContent='Deletion analytics unavailable. Previous snapshot may be outdated. Refresh All to retry.';return false;}
}
