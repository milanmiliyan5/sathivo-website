// One-day, homepage-only appreciation message. No account data is collected.
export const START=Date.parse('2026-11-19T00:00:00+05:30');
export const END=Date.parse('2026-11-20T00:00:00+05:30');
export const DELAY=3000;
const KEY='sathivo.mens-day.2026.seen';
export const isActive=(now=Date.now())=>now>=START&&now<END;
let seenHere=false,timer=null,expiry=null,dialog=null;
function seen(){
 if(seenHere)return true;
 try{if(localStorage.getItem(KEY)==='1')return true;}catch{}
 try{return sessionStorage.getItem(KEY)==='1';}catch{return false;}
}
function remember(){
 seenHere=true;
 try{localStorage.setItem(KEY,'1');}catch{}
 try{sessionStorage.setItem(KEY,'1');}catch{}
}
function safe(){
 return !document.hidden&&!document.querySelector('dialog[open]')&&
 !document.body.classList.contains('modal-open')&&!document.body.classList.contains('auth-pending')&&
 !document.querySelector('.mobile-header-menu[open],form[aria-busy="true"],[data-updating="true"]')&&
 !document.activeElement?.matches('input,textarea,select,[contenteditable],button[disabled]');
}
function schedule(ms){
 clearTimeout(timer);
 if(isActive()&&!seen())timer=setTimeout(attempt,ms);
}
function attempt(){
 timer=null;
 if(!isActive()||seen())return;
 if(!safe()){schedule(2000);return;}
 const d=document.createElement('dialog');
 if(typeof d.showModal!=='function')return;
 d.className='mens-day-popup';
 d.setAttribute('aria-labelledby','mens-day-title');
 d.setAttribute('aria-describedby','mens-day-copy');
 d.innerHTML=`<div class="mens-day-art">
 <button type="button" class="mens-day-close" aria-label="Close Men's Day message">×</button>
 <svg viewBox="0 0 320 132" role="img" aria-label="Three friends standing together under a blue heart">
 <circle cx="160" cy="65" r="62" fill="#e0ecff"/><circle cx="160" cy="65" r="48" fill="#f2f7ff"/>
 <g fill="none" stroke="#87aada" stroke-width="2" stroke-linecap="round"><path d="M38 51h12m-6-6v12M271 35h12m-6-6v12M61 99h8m-4-4v8M253 98h10m-5-5v10"/></g>
 <g class="mens-day-heart"><path d="M160 35c-18-12-18-20-11-23 5-3 10 1 11 4 2-3 7-7 12-4 7 4 6 12-12 23z" fill="#4b79be"/></g>
 <g stroke="#f0f5ff" stroke-width="2"><path d="M79 119V91q0-21 28-23 28 2 28 23v28z" fill="#7295ca"/><path d="M185 119V91q0-21 28-23 28 2 28 23v28z" fill="#7394bc"/>
 <path d="M126 119V85q0-24 34-25 34 1 34 25v34z" fill="#28558e"/></g>
 <g><circle cx="107" cy="54" r="17" fill="#bd896d"/><path d="M90 53q-2-23 17-23 19 0 18 21l-5-7q-17 4-24-1z" fill="#344e6d"/><circle cx="213" cy="54" r="17" fill="#e0b495"/><path d="M196 51q-2-22 17-22 19 0 18 24l-7-11q-15 4-23 0z" fill="#334964"/><circle cx="160" cy="45" r="19" fill="#d3a181"/><path d="M141 44q-1-24 19-24 21 0 19 24l-6-12q-16 6-25 0z" fill="#233e63"/></g>
 <path d="M47 120h226" stroke="#aec5e7" stroke-width="2" stroke-linecap="round"/>
 </svg></div>
 <div class="mens-day-content"><p class="mens-day-date">19 NOVEMBER 2026 · INTERNATIONAL MEN'S DAY</p>
 <h2 id="mens-day-title">Happy International Men's Day! <span aria-hidden="true">💙</span></h2>
 <p id="mens-day-copy">You deserve to be heard, appreciated, supported and valued.</p>
 <p class="mens-day-message">Your feelings matter. Your happiness matters. You matter.</p>
 <p class="mens-day-team">With appreciation, Team Sathivo</p>
 <button type="button" class="mens-day-thanks">Thank You 💙</button></div>`;
 const previous=document.activeElement;
 const close=()=>{if(d.open)d.close();};
 d.querySelector('.mens-day-close').addEventListener('click',close);
 d.querySelector('.mens-day-thanks').addEventListener('click',close);
 d.addEventListener('click',e=>{if(e.target===d)close();});
 d.addEventListener('close',()=>{clearTimeout(expiry);dialog=null;d.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
 document.body.append(d);
 try{d.showModal();dialog=d;remember();expiry=setTimeout(close,Math.max(0,END-Date.now()));}
 catch{d.remove();}
}
function init(){
 if(!isActive()||seen())return;
 schedule(DELAY);
 document.addEventListener('visibilitychange',()=>{
  if(!isActive()){if(dialog?.open)dialog.close();clearTimeout(timer);return;}
  if(!document.hidden&&!dialog&&!seen()&&timer===null)schedule(DELAY);
 });
 window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue==='1'){clearTimeout(timer);timer=null;if(dialog?.open)dialog.close();}});
}
if(typeof document!=='undefined'&&typeof window!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
}
