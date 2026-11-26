// Founder-only controls: server-enforced and audited.
const $=id=>document.getElementById(id);
const make=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cls)n.className=cls;return n};
const titles={new_bookings:['New booking requests','Pause new requests; existing bookings remain available.'],chat_photos:['Chat photo sharing','Pause new photos; text chat and existing photos remain available.'],view_once_photos:['View-once photos','Pause new view-once photos only.']};
const date=new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'});
export function initFounder(client){
 let running=null,mutating=false,rows=[],audit=[],ready=false;
 $('founder-nav').hidden=false;$('founder-section').hidden=false;
 const status=$('founder-status');
 function render(){
  for(const kind of ['feature','activity']){
   const root=$(kind==='feature'?'founder-features':'founder-activities');
   root.replaceChildren(...rows.filter(r=>r.kind===kind).map(r=>{
    const row=make('div',undefined,'founder-control-row'),copy=make('div',undefined,'primary-cell');
    const info=kind==='feature'?titles[r.control_key]:[r.control_key,'New bookings'];
    copy.append(make('strong',info?.[0]||r.control_key),make('small',info?.[1]||''));
    const button=make('button',r.enabled?'ON':'OFF','founder-switch');button.type='button';
    button.setAttribute('role','switch');button.setAttribute('aria-checked',String(r.enabled));button.setAttribute('aria-label',info?.[0]||r.control_key);
    button.disabled=!ready||mutating||!!running;button.onclick=()=>void toggle(r);
    row.append(copy,button);return row;
   }));
  }
  $('founder-audit-body').replaceChildren(...(audit.length?audit.map(r=>{
   const tr=make('tr');for(const [label,v] of [['Date',date.format(new Date(r.created_at))],['Action',r.action.replaceAll('_',' ')],['Target',r.target],['Before',r.before_value??'—'],['After',r.after_value??'—']]){const td=make('td',v);td.dataset.label=label;tr.append(td);}return tr;
  }):[(()=>{const tr=make('tr'),td=make('td','No recorded owner changes yet.');td.colSpan=5;tr.append(td);return tr;})()]));
 }
 async function load(){
  const [controls,history]=await Promise.all([
   client.from('founder_controls').select('kind,control_key,enabled,updated_at').order('control_key'),
   client.from('founder_audit').select('id,action,target,before_value,after_value,created_at').order('id',{ascending:false}).limit(50)
  ]);
  if(controls.error||history.error)throw controls.error||history.error;
  if(!Array.isArray(controls.data)||controls.data.length<3)throw Error('Founder controls unavailable.');
  rows=controls.data;audit=history.data||[];ready=true;
 }
 function refresh(){
  if(running)return running;
  if(mutating)return Promise.resolve(false);
  ready=false;status.textContent='Loading owner controls…';
  running=(async()=>{try{await load();status.textContent='Owner controls updated. No automatic polling.';return true;}
  catch{status.textContent='Could not load owner controls. Use Refresh All to retry.';return false;}
  finally{running=null;render();}})();
  render();return running;
 }
 async function toggle(r){
  if(!ready||mutating||running)return;
  const label=titles[r.control_key]?.[0]||r.control_key;
  if(!window.confirm((r.enabled?'Pause ':'Enable ')+label+'? This changes new activity on the live website and is recorded.'))return;
  mutating=true;render();
  try{
   const {data,error}=await client.from('founder_controls').update({enabled:!r.enabled}).eq('kind',r.kind).eq('control_key',r.control_key).eq('enabled',r.enabled).select('enabled').maybeSingle();
   if(error)throw error;if(!data)throw Error('Setting changed elsewhere. Refresh and retry.');
   ready=false;await load();status.textContent=label+' updated.';
  }catch(e){ready=false;status.textContent='Could not confirm update. Refresh All before making another change.';}
  finally{mutating=false;render();}
 }
 return {refresh};
}
