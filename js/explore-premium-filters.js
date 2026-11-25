// Progressive enhancement: the existing native select fields remain the source of truth.
export function connectChoice(select,group){
 const buttons=Array.from(group.querySelectorAll('button[data-value]'));
 const sync=()=>buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.value===select.value)));
 buttons.forEach(button=>button.addEventListener('click',()=>{
  if(select.disabled||select.value===button.dataset.value)return;
  select.value=button.dataset.value;sync();
  select.dispatchEvent(new Event('change',{bubbles:true}));
 }));
 select.addEventListener('change',sync);
 sync();
 return sync;
}
export function enhancePremiumFilters(form,disclosure){
 if(!form||!disclosure)return;
 const syncs=[];
 const shortLabels={'gender-filter':{'':'All'},mode:{'':'Any'}};
 for(const id of ['gender-filter','mode']){
  const select=form.querySelector('#'+id);if(!select)continue;
  const label=form.querySelector('label[for="'+id+'"]');if(!label)continue;
  const group=document.createElement('div');group.className='premium-choice-buttons';
  group.setAttribute('role','group');group.setAttribute('aria-label',label.textContent.trim());
  group.style.setProperty('--choices',String(select.options.length));
  for(const option of select.options){
   const button=document.createElement('button');button.type='button';button.dataset.value=option.value;
   button.textContent=shortLabels[id][option.value]??option.textContent;
   group.append(button);
  }
  select.after(group);
  syncs.push(connectChoice(select,group));
  select.hidden=true;
 }
 // The original directory reset handler resets all native inputs. Sync after it runs.
 form.addEventListener('reset',()=>queueMicrotask(()=>syncs.forEach(sync=>sync())));
 const close=form.querySelector('#close-directory-filters');
 const collapse=()=>{disclosure.open=false;};
 if(close){close.hidden=false;close.addEventListener('click',()=>{collapse();disclosure.querySelector('summary')?.focus({preventScroll:true});});}
 form.addEventListener('submit',collapse);
 disclosure.addEventListener('toggle',()=>{if(disclosure.open)syncs.forEach(sync=>sync());});
}
if(typeof document!=='undefined')enhancePremiumFilters(document.getElementById('filters'),document.getElementById('directory-filters'));
