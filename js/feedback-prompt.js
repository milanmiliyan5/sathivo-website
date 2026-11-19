import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';

export const DAY=86400000;
export const FIRST_DELAY=10000;
const KEY='sathivo.feedback-prompt.v1:';
const memory=new Map();
const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3zM7 8h10M7 12h7"/></svg>';
let activeUser=null, timer=null, dialog=null, shortcut=null, startedAt=0, completionPending=false, completionAttempted=false;

export function eligible(user,state={},now=Date.now(),completion=false){
 const created=Date.parse(user?.created_at||'');
 return Boolean(user?.id)&&Number.isFinite(created)&&created<=now&&
  (completion||now-created>=DAY)&&
  !(Number(state.lastShown)>0&&now-Number(state.lastShown)<DAY)&&
  !(Number(state.until)>now);
}
function read(id){
 let stored={};
 try{stored=JSON.parse(localStorage.getItem(KEY+id)||'{}')||{}}catch{}
 const cached=memory.get(id)||{};
 return {lastShown:Math.max(Number(stored.lastShown)||0,cached.lastShown||0),until:Math.max(Number(stored.until)||0,cached.until||0)};
}
function save(id,patch){
 const old=read(id),next={lastShown:Math.max(old.lastShown,patch.lastShown||0),until:Math.max(old.until,patch.until||0)};
 memory.set(id,next);
 try{localStorage.setItem(KEY+id,JSON.stringify(next));return true}catch{return false}
}
export function recordFeedbackSubmitted(id,now=Date.now()){
 if(id)save(id,{until:now+30*DAY});
}
function safeToOpen(){
 return !document.hidden&&!document.querySelector('dialog[open]')&&
 !document.body.classList.contains('modal-open')&&
 !document.body.classList.contains('auth-pending')&&
 !document.querySelector('.mobile-header-menu[open]')&&
 !document.activeElement?.matches('input,textarea,select,[contenteditable],button[disabled]')&&
 !document.querySelector('form[aria-busy="true"],[data-updating="true"]');
}
function show(user,manual=false,completion=false){
 if(dialog||document.querySelector('dialog[open]'))return false;
 if(!manual&&(!safeToOpen()||!eligible(user,read(user.id),Date.now(),completion)))return false;
 const d=document.createElement('dialog');
 if(typeof d.showModal!=='function')return false;
 d.className='feedback-prompt';
 d.setAttribute('aria-labelledby','feedback-prompt-title');
 d.setAttribute('aria-describedby','feedback-prompt-copy');
 d.innerHTML=`<div class="feedback-prompt-inner">
 <div class="feedback-prompt-art">
 <button type="button" class="feedback-prompt-close" aria-label="Close feedback request">×</button>
 <svg class="feedback-prompt-illustration" viewBox="0 0 280 128" aria-hidden="true">
 <circle cx="140" cy="62" r="53" fill="#edd0df"/><circle cx="140" cy="62" r="43" fill="#fdf1f6"/>
 <g class="feedback-float"><g transform="rotate(-9 133 59)"><rect x="91" y="27" width="87" height="62" rx="17" fill="#a3446b"/><path d="M106 80 103 103 128 85" fill="#a3446b"/><path d="M108 46h51m-51 11h45m-45 11h31" stroke="white" stroke-width="4.5" stroke-linecap="round"/></g><circle cx="177" cy="86" r="21" fill="#fffaf8" stroke="#e7bed0" stroke-width="2"/><path d="M177 95C155 81 172 72 177 81C184 70 199 83 177 95" fill="#a3446b"/></g>
 <path d="m66 24 3 8 8 3-8 3-3 8-3-8-8-3 8-3zM210 21l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#bd7898"/><circle cx="69" cy="88" r="4" fill="#cfa2b8"/><circle cx="215" cy="73" r="3" fill="#bd7898"/>
 </svg></div><div class="feedback-prompt-content">
 <p class="feedback-prompt-kicker">A LITTLE HELP GOES A LONG WAY</p>
 <h2 id="feedback-prompt-title">Help us make Sathivo better!</h2>
 <p id="feedback-prompt-copy">Enjoying Sathivo? Have a suggestion or facing an issue? We'd love to hear from you.</p>
 <p class="feedback-prompt-voice">Your voice makes a difference. ♡</p>
 <a class="feedback-prompt-action" href="feedback.html">${icon}<span>Share Feedback</span><span aria-hidden="true">→</span></a>
 <button type="button" class="feedback-prompt-later">Maybe later</button>
 </div></div>`;
 let dismissed=false;
 const previous=document.activeElement;
 const remember=()=>{if(!dismissed){dismissed=true;save(user.id,{until:Date.now()+7*DAY});}};
 const close=()=>{remember();d.close()};
 d.querySelector('.feedback-prompt-close').addEventListener('click',close);
 d.querySelector('.feedback-prompt-later').addEventListener('click',close);
 d.querySelector('.feedback-prompt-action').addEventListener('click',remember);
 d.addEventListener('cancel',e=>{e.preventDefault();close()});
 d.addEventListener('click',e=>{if(e.target===d)close()});
 d.addEventListener('close',()=>{remember();if(dialog===d)dialog=null;d.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
 document.body.append(d);
 try{d.showModal();dialog=d;save(user.id,{lastShown:Date.now()});return true}
 catch{d.remove();return false}
}
function clearTimer(){if(timer!==null)clearTimeout(timer);timer=null}
function schedule(delay){
 clearTimer();
 if(!activeUser)return;
 timer=setTimeout(attempt,Math.max(0,delay));
}
function attempt(){
 timer=null;
 const user=activeUser;
 if(!user)return;
 const completion=completionPending;
 if(!eligible(user,read(user.id),Date.now(),completion)){completionPending=false;return}
 if(!safeToOpen()){schedule(2000);return}
 if(show(user,false,completion))completionPending=false;
}
function manual(event){
 if(!activeUser)return;
 if(show(activeUser,true)){event.preventDefault();clearTimer();completionPending=false;}
}
export function stopFeedbackPrompt(){
 clearTimer();activeUser=null;completionPending=false;completionAttempted=false;
 if(shortcut){shortcut.hidden=true;shortcut.removeEventListener('click',manual);shortcut=null}
 if(dialog?.open)dialog.close();
}
export function startFeedbackPrompt(user){
 if(!user?.id)return;
 if(activeUser?.id===user.id)return;
 stopFeedbackPrompt();
 activeUser=user;startedAt=Date.now();
 shortcut=document.querySelector('.feedback-shortcut');
 if(shortcut){shortcut.hidden=false;shortcut.addEventListener('click',manual)}
 if(eligible(user,read(user.id),startedAt))schedule(FIRST_DELAY);
}
export function offerCompletionFeedback(user){
 if(!user?.id)return;
 if(activeUser?.id!==user.id){stopFeedbackPrompt();activeUser=user}
 if(completionAttempted||!eligible(user,read(user.id),Date.now(),true))return;
 completionAttempted=true;completionPending=true;schedule(800);
}
// Home only. Account starts its own prompt after its authenticated panel renders.
// Other pages import only the explicit completion/submission functions.
async function home(){
 try{
  const client=await getSathivoClient();
  client.auth.onAuthStateChange((_event,session)=>{
   if(session?.user)startFeedbackPrompt(session.user);
   else stopFeedbackPrompt();
  });
  const {data,error}=await client.auth.getSession();
  if(!error&&data?.session?.user)startFeedbackPrompt(data.session.user);
 }catch{}
}
if(typeof document!=='undefined'&&typeof location!=='undefined'&&
 /\/(?:index\.html)?$/.test(location.pathname)&&!document.querySelector('.feedback-shortcut'))void home();
