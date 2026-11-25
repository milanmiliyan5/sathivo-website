// Reset after layout and mobile keyboard changes, without pulling the user
// back up once they deliberately interact with the newly opened section.
export function createProfileScrollReset(win,doc){
 let frame=0,timer=0,active=false;
 const viewport=win.visualViewport;
 const gestures=['pointerdown','touchstart','wheel','keydown'];
 function cancel(){
  if(frame)win.cancelAnimationFrame(frame);
  if(timer)win.clearTimeout(timer);
  frame=timer=0;
  if(!active)return;
  active=false;
  viewport?.removeEventListener('resize',settle);
  for(const event of gestures)win.removeEventListener(event,cancel,true);
 }
 function top(){win.scrollTo({top:0,left:0,behavior:'instant'});}
 function settle(){
  if(!active)return;
  if(frame)win.cancelAnimationFrame(frame);
  frame=win.requestAnimationFrame(()=>{
   frame=0;if(!active)return;top();
   frame=win.requestAnimationFrame(()=>{frame=0;if(active)top();});
  });
 }
 function reset(){
  cancel();active=true;
  const focused=doc.activeElement;
  if(focused?.matches?.('input,textarea,select,[contenteditable="true"]'))focused.blur();
  for(const event of gestures)win.addEventListener(event,cancel,{capture:true,passive:true});
  viewport?.addEventListener('resize',settle);
  top();settle();
  timer=win.setTimeout(cancel,650);
 }
 return {reset,cancel};
}
