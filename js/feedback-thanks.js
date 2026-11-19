export function bindFeedbackThanks(dialog){
 if(!dialog||typeof dialog.showModal!=='function')return ()=>{};
 let previous=null;
 const close=()=>{if(dialog.open)dialog.close()};
 dialog.querySelector('.feedback-thanks-done')?.addEventListener('click',close);
 dialog.querySelector('.feedback-thanks-close')?.addEventListener('click',close);
 dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
 dialog.addEventListener('close',()=>{if(previous?.isConnected)previous.focus({preventScroll:true});previous=null});
 return trigger=>{
  if(dialog.open)return;
  previous=trigger;
  // Popup failure must never turn a saved feedback into a submission error.
  try{dialog.showModal()}catch{previous=null}
 };
}
