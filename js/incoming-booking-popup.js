/* Sathivo incoming booking reminders — UI only. Never changes booking status.
 * Session-level X / Maybe later; per-booking Don't show again persists in Supabase. */
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {withCurrentBookingNames} from './booking-name-sync.js?v=20261030-1';

const sessionPrefix='sathivo:incoming-popup:v1:';
const stylesheet='incoming-booking-popup.css?v=20261122-1';
let booted=false,checking=false,sessionFallback=new Set();

function wasShown(uid) {
  try{return sessionStorage.getItem(sessionPrefix+uid)==='1';}
  catch{return sessionFallback.has(uid);}
}
function markShown(uid) {
  sessionFallback.add(uid);
  try{sessionStorage.setItem(sessionPrefix+uid,'1');}catch{}
}
function el(tag,className,text) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}
function appendStyles(){
  if(document.querySelector('link[data-incoming-popup-style]'))return;
  const link=el('link');link.rel='stylesheet';link.href=stylesheet;link.dataset.incomingPopupStyle='true';document.head.append(link);
}
function formatted(iso) {
  const date=new Date(iso);
  if(Number.isNaN(date.getTime()))return 'Date to be confirmed';
  return new Intl.DateTimeFormat('en-IN',{
    timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',
    hour:'numeric',minute:'2-digit',hour12:true
  }).format(date);
}
function offered(row){
  const raw=row.offered_hourly_rate??row.listed_hourly_rate;
  const amount=Number(raw);
  return Number.isFinite(amount)&&amount>0?'₹'+amount.toLocaleString('en-IN')+'/hr':'Offer to be discussed';
}
function iconLine(icon,label){
  const line=el('div','sbi-line');line.append(el('span','sbi-line-icon',icon),el('span','',label));return line;
}
function showPopup(client,user,records) {
  appendStyles();
  let recordsLeft=[...records],index=0,transitioning=false,dragX=null,dragY=0,
    dragging=false,startPointer=null;
  const dialog=el('dialog','sbi-dialog');
  dialog.setAttribute('aria-labelledby','sbi-title');
  const header=el('div','sbi-header');
  header.append(el('span','sbi-mark','♡'),el('span','sbi-brand','Sathivo / Incoming'));
  const close=el('button','sbi-x','×');close.type='button';close.title='Close for now';
  close.setAttribute('aria-label','Close popup for now');header.append(close);
  const title=el('h2','sbi-title','You’ve got new plans! 💌');title.id='sbi-title';
  const subtitle=el('p','sbi-subtitle');
  const stage=el('div','sbi-stage');
  stage.append(el('div','sbi-back sbi-back-far'),el('div','sbi-back sbi-back-near'));
  const card=el('article','sbi-card');stage.append(card);
  const row=el('div','sbi-navigation');
  const prev=el('button','sbi-arrow','‹');prev.type='button';prev.setAttribute('aria-label','Previous booking');
  const dots=el('div','sbi-dots');
  const next=el('button','sbi-arrow','›');next.type='button';next.setAttribute('aria-label','Next booking');
  row.append(prev,dots,next);
  const hint=el('p','sbi-hint','Swipe left or right to flip the cards');
  const later=el('button','sbi-later','Maybe later');later.type='button';
  const status=el('p','sbi-status');status.setAttribute('role','status');status.hidden=true;
  dialog.append(header,title,subtitle,stage,row,hint,later,status);
  document.body.append(dialog);

  function finish(){
    if(dialog.open)dialog.close();
    else dialog.remove();
  }
  close.addEventListener('click',finish);
  later.addEventListener('click',finish);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.addEventListener('click',event=>{if(event.target===dialog)finish();});
  function resetCard(){
    card.style.transition='none';
    card.style.transform='translate3d(0,0,0)';
    card.style.opacity='1';
    void card.offsetWidth;
    card.style.transition='';
  }
  function render(){
    if(!recordsLeft.length){finish();return;}
    index=(index%recordsLeft.length+recordsLeft.length)%recordsLeft.length;
    const b=recordsLeft[index];
    subtitle.textContent=recordsLeft.length+' pending request'+(recordsLeft.length===1?'':'s')+' waiting for your response.';
    status.hidden=true;status.textContent='';
    card.replaceChildren();
    const upper=el('div','sbi-between');
    upper.append(el('span','sbi-pending','● Pending request'),el('span','sbi-count',(index+1)+' / '+recordsLeft.length));
    const profile=el('div','sbi-person');
    profile.append(el('div','sbi-avatar',String(b.customer_display_name||'S').trim().slice(0,1).toUpperCase()));
    const name=el('div','sbi-person-copy');
    name.append(el('strong','',b.customer_display_name||'Sathivo member'),el('span','','Wants to book your time'));
    profile.append(name);
    const details=el('div','sbi-details');
    details.append(
      iconLine('♡',b.category||'Companionship'),
      iconLine('▦',formatted(b.requested_for)),
      iconLine('⌖',b.meeting_mode==='in-person'?'In person — public place':'Online'),
      iconLine('◷',String(b.duration_minutes||60)+' minutes'),
      iconLine('₹',offered(b))
    );
    const bottom=el('div','sbi-actions');
    const open=el('button','sbi-open','View request ↗');open.type='button';
    open.addEventListener('click',()=>{finish();location.assign('requests.html?id='+encodeURIComponent(b.id));});
    const hide=el('button','sbi-hide','☑ Don’t show this request again');hide.type='button';
    hide.addEventListener('click',async()=>{
      if(transitioning)return;
      transitioning=true;hide.disabled=true;status.hidden=true;
      try{
        const {error}=await client.from('incoming_booking_popup_dismissals')
          .insert({user_id:user.id,booking_id:b.id});
        if(error&&error.code!=='23505')throw error;
        card.style.transition='transform .3s cubic-bezier(.2,.8,.2,1), opacity .3s';
        card.style.transform='translate3d(110%,0,0) rotate(10deg)';card.style.opacity='0';
        await new Promise(resolve=>setTimeout(resolve,300));
        recordsLeft=recordsLeft.filter(item=>item.id!==b.id);
        if(index>=recordsLeft.length)index=0;
        resetCard();render();
      }catch{
        status.hidden=false;status.textContent='Could not save this choice. Please try again.';
      }finally{transitioning=false;hide.disabled=false;}
    });
    bottom.append(open,hide);
    card.append(upper,profile,el('div','sbi-rule'),details,bottom);
    dots.replaceChildren();
    recordsLeft.forEach((record,i)=>{
      const dot=el('button','sbi-dot'+(i===index?' sbi-dot-active':''));
      dot.type='button';dot.setAttribute('aria-label','Show request '+(i+1));
      dot.addEventListener('click',()=>slide(i>index?-1:1));dots.append(dot);
    });
    stage.classList.toggle('sbi-single',recordsLeft.length===1);
    prev.disabled=next.disabled=recordsLeft.length<2;
  }
  async function slide(direction){
    if(transitioning||recordsLeft.length<2)return;
    transitioning=true;
    card.style.transition='transform .31s cubic-bezier(.2,.8,.2,1), opacity .31s ease';
    card.style.transform='translate3d('+(direction*112)+'%,0,0) rotate('+(direction*11)+'deg)';
    card.style.opacity='0.1';
    await new Promise(resolve=>setTimeout(resolve,310));
    index=(index+(direction<0?1:-1)+recordsLeft.length)%recordsLeft.length;
    render();
    card.style.transition='none';
    card.style.transform='translate3d('+(-direction*36)+'px,0,0) scale(.96)';
    card.style.opacity='.5';
    void card.offsetWidth;
    card.style.transition='transform .27s cubic-bezier(.16,1,.3,1),opacity .27s';
    card.style.transform='translate3d(0,0,0) scale(1)';card.style.opacity='1';
    await new Promise(resolve=>setTimeout(resolve,275));
    card.style.transition='';card.style.transform='';transitioning=false;
  }
  prev.addEventListener('click',()=>void slide(1));
  next.addEventListener('click',()=>void slide(-1));
  card.addEventListener('pointerdown',event=>{
    if(transitioning||event.target.closest('button'))return;
    dragX=event.clientX;dragY=event.clientY;startPointer=event.pointerId;dragging=false;
  });
  card.addEventListener('pointermove',event=>{
    if(dragX===null||startPointer!==event.pointerId||transitioning)return;
    const dx=event.clientX-dragX,dy=event.clientY-dragY;
    if(!dragging&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){dragX=null;return;}
    if(Math.abs(dx)>8)dragging=true;
    if(dragging){
      try{card.setPointerCapture(event.pointerId);}catch{}
      card.style.transition='none';
      card.style.transform='translate3d('+dx+'px,0,0) rotate('+(dx/30)+'deg)';
      card.style.opacity=String(Math.max(.65,1-Math.abs(dx)/800));
    }
  });
  card.addEventListener('pointerup',event=>{
    if(dragX===null||startPointer!==event.pointerId)return;
    const dx=event.clientX-dragX;
    dragX=null;startPointer=null;
    try{card.releasePointerCapture(event.pointerId);}catch{}
    if(dragging&&Math.abs(dx)>55){dragging=false;void slide(dx<0?-1:1);}
    else{
      dragging=false;
      card.style.transition='transform .28s cubic-bezier(.16,1,.3,1),opacity .28s';
      card.style.transform='';card.style.opacity='1';
    }
  });
  card.addEventListener('pointercancel',()=>{dragX=null;dragging=false;card.style.transform='';card.style.opacity='1';});
  dialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){event.preventDefault();void slide(1);}
    if(event.key==='ArrowRight'){event.preventDefault();void slide(-1);}
  });
  render();
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.remove();
}
async function maybeOpen(client){
  if(checking||document.hidden)return;
  checking=true;
  try{
    const {data:auth,error:authError}=await client.auth.getUser();
    if(authError||!auth?.user)return;
    const user=auth.user;
    if(wasShown(user.id))return;
    const [bookings,dismissals]=await Promise.all([
      client.from('booking_requests')
        .select('id,customer_id,customer_display_name,category,requested_for,meeting_mode,duration_minutes,offered_hourly_rate,listed_hourly_rate')
        .eq('companion_id',user.id).eq('status','pending').order('created_at',{ascending:false}).limit(100),
      client.from('incoming_booking_popup_dismissals').select('booking_id').eq('user_id',user.id)
    ]);
    if(bookings.error||dismissals.error)throw (bookings.error||dismissals.error);
    const hidden=new Set((dismissals.data||[]).map(x=>x.booking_id));
    const eligible=(bookings.data||[]).filter(row=>!hidden.has(row.id));
    if(!eligible.length){markShown(user.id);return;}
    if(document.querySelector('dialog[open]')){
      setTimeout(()=>void maybeOpen(client),2000);
      return;
    }
    const named=await withCurrentBookingNames(client,eligible);
    if(document.querySelector('dialog[open]')){
      setTimeout(()=>void maybeOpen(client),2000);
      return;
    }
    markShown(user.id);
    showPopup(client,user,named);
  }catch(error){
    // Don't mark viewed on failure; a subsequent page load can retry safely.
    console.warn('Incoming booking popup unavailable',error?.message||error);
  }finally{checking=false;}
}
export function initIncomingBookingPopup(){
  if(booted)return;
  booted=true;
  void getSathivoClient().then(client=>{
    const schedule=()=>setTimeout(()=>void maybeOpen(client),1200);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
    else schedule();
    client.auth.onAuthStateChange((event)=>{
      if(event==='SIGNED_IN')setTimeout(()=>void maybeOpen(client),1600);
    });
  }).catch(()=>{});
}
initIncomingBookingPopup();
