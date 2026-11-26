// Founder-only controls: server-enforced and audited.
const $=id=>document.getElementById(id);
const make=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cls)n.className=cls;return n};
const titles={new_bookings:['New booking requests','Pause new requests; existing bookings remain available.'],chat_photos:['Chat photo sharing','Pause new photos; text chat and existing photos remain available.'],view_once_photos:['View-once photos','Pause new view-once photos only.']};
Object.assign(titles,{
 profile_onboarding:['New profile setup','Pause first-time profile creation, not Auth signup or existing login.'],
 new_publications:['New companion publications','Pause new public listings. Existing bookings and public profiles remain available.'],
 new_contributions:['New contribution payments','Pause new payment reservations. Existing orders and refunds are not changed.'],
 marketplace_new_activity:['New marketplace activity','OFF pauses new profiles, listings and bookings for maintenance. Existing chats, login and support remain available.']
});
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
 let memberToken=0;
 async function attachMember(p,root){
  const token=++memberToken;
  const active=()=>token===memberToken&&root.isConnected;
  root.replaceChildren(make('p','Checking restriction status…','panel-note'));
  const response=await client.from('founder_member_restrictions').select('restricted,reason').eq('user_id',p.user_id).maybeSingle();
  if(!active())return;
  if(response.error){root.replaceChildren(make('p','Could not check restriction. Close and reopen details.','panel-note'));return;}
  const row=response.data,restricted=row?.restricted===true;
  const state=make('p',restricted?'Marketplace activity restricted':'Marketplace activity enabled','panel-note');
  const status=make('p','','panel-note');status.setAttribute('role','status');
  const restriction=make('button',restricted?'Restore activity':'Restrict activity','admin-btn'+(restricted?'':' danger'));restriction.type='button';
  const notice=make('button','Send account notice','admin-btn');notice.type='button';
  const group=make('div',undefined,'action-group');group.append(restriction,notice);
  root.replaceChildren(state,make('p','Restrictions stop new bookings and outgoing messages. Existing records, support and sign-in are preserved. Listing visibility is managed separately.','panel-note'),group,status);
  restriction.onclick=async()=>{
   if(!active()||restriction.disabled)return;
   const reason=window.prompt(restricted?'Reason for restoring activity (5–300 characters)':'Reason for restricting activity (5–300 characters)');
   if(!reason||reason.trim().length<5||reason.trim().length>300)return;
   if(!window.confirm((restricted?'Restore':'Restrict')+' marketplace activity for '+(p.display_name||'this member')+'? The member receives an in-app notice; the action is audited.'))return;
   restriction.disabled=notice.disabled=true;
   try{
    const payload={restricted:!restricted,reason:reason.trim()};
    const r=row?await client.from('founder_member_restrictions').update(payload).eq('user_id',p.user_id).eq('restricted',restricted).select('restricted').maybeSingle():await client.from('founder_member_restrictions').insert({user_id:p.user_id,...payload}).select('restricted').single();
    if(r.error||!r.data)throw Error('Could not confirm change. Close and reopen details.');
    if(active())await attachMember(p,root);
    void refresh();
   }catch(e){if(active()){status.textContent=e.message||'Could not confirm update. Close and reopen details.';restriction.disabled=notice.disabled=false;}}
  };
  notice.onclick=async()=>{
   if(!active()||notice.disabled)return;
   const message=window.prompt('Account notice (5–400 characters). This appears in Sathivo notifications, not email.');
   if(!message||message.trim().length<5||message.trim().length>400)return;
   if(!window.confirm('Send this in-app notice to '+(p.display_name||'this member')+'?'))return;
   restriction.disabled=notice.disabled=true;
   try{
    const r=await client.from('founder_member_notices').insert({user_id:p.user_id,message:message.trim()}).select('id').single();
    if(r.error||!r.data)throw Error('Could not confirm notice delivery.');
    if(active())status.textContent='In-app notice recorded and delivered to the notifications list.';
    void refresh();
   }catch(e){if(active())status.textContent=e.message||'Could not confirm notice.';}
   finally{if(active())restriction.disabled=notice.disabled=false;}
  };
 }
 return {refresh,attachMember};
}
