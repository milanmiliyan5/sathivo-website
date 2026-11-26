// Constitution Day 2026: local-only, one-day greeting. No email, push or API requests.
export const START=Date.parse('2026-11-26T00:00:00+05:30');
export const END=Date.parse('2026-11-27T00:00:00+05:30');
export const DELAY=7000;
const KEY='sathivo.constitution-day.2026.seen';
export const isActive=(now=Date.now())=>now>=START&&now<END;
let seenHere=false,timer=null,expiry=null,dialog=null,stopFlag=null;
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
export function canShow(doc,loc){
 if(!doc||doc.hidden||doc.visibilityState==='hidden')return false;
 // Never interrupt entry splash, authentication or another modal.
 if(loc?.hash&&loc.hash!=='#account')return false;
 if(doc.documentElement?.classList.contains('sathivo-entry-pending')||
 doc.documentElement?.classList.contains('sathivo-policy-gate-open')||
 doc.body?.classList.contains('modal-open')||doc.body?.classList.contains('auth-pending'))return false;
 if(doc.querySelector('dialog[open], [aria-modal="true"], .sathivo-launch-screen, .mobile-header-menu[open], form[aria-busy="true"], [data-updating="true"]'))return false;
 if(doc.activeElement?.matches?.('input,textarea,select,[contenteditable],button[disabled]'))return false;
 return true;
}
const svgMarkup=`<svg class="cd-flag" viewBox="0 0 280 166" role="img" aria-label="Indian national flag waving, with a navy blue 24-spoke Ashoka Chakra">
 <defs>
  <linearGradient id="cd-pole"><stop stop-color="#826443"/><stop offset=".5" stop-color="#f8dfa8"/><stop offset="1" stop-color="#b79764"/></linearGradient>
  <clipPath id="cd-cloth"><path data-cd-outline d="M48 23H228V143H48Z"/></clipPath>
  <linearGradient id="cd-folds" gradientUnits="userSpaceOnUse" x1="48" x2="148" y1="0" y2="0" spreadMethod="repeat">
   <stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/>
   <stop offset=".5" stop-color="#382d26" stop-opacity=".12"/><stop offset=".75" stop-color="#382d26" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/>
  </linearGradient>
 </defs>
 <ellipse cx="46" cy="157" rx="19" ry="3" fill="#7e5d48" opacity=".15"/>
 <rect x="43" y="10" width="5" height="145" rx="2" fill="url(#cd-pole)"/><circle cx="45.5" cy="9" r="5" fill="url(#cd-pole)"/>
 <path data-cd-stripe fill="#FF9933" d="M48 23H228V63H48Z"/><path data-cd-stripe fill="#fff" d="M48 63H228V103H48Z"/><path data-cd-stripe fill="#138808" d="M48 103H228V143H48Z"/>
 <rect x="48" y="8" width="180" height="150" clip-path="url(#cd-cloth)" fill="url(#cd-folds)"/>
 <g data-cd-wheel transform="translate(138 83)"><circle r="12" fill="none" stroke="#000080" stroke-width="1.5"/>${Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return '<line x1="0" y1="0" x2="'+(12*Math.cos(a)).toFixed(3)+'" y2="'+(12*Math.sin(a)).toFixed(3)+'" stroke="#000080" stroke-width=".75"/>'}).join('')}<circle r="1.8" fill="#000080"/></g>
 </svg>`;
function animateFlag(d){
 const svg=d.querySelector('.cd-flag'),stripes=[...svg.querySelectorAll('[data-cd-stripe]')],outline=svg.querySelector('[data-cd-outline]'),wheel=svg.querySelector('[data-cd-wheel]'),folds=svg.querySelector('#cd-folds');
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let raf=null,stopped=false,last=0;
 function frame(ms){
  raf=null;if(stopped||!d.open||document.hidden||motion.matches)return;
  if(ms-last>=15){
   last=ms;const t=ms/1050;
   const wave=x=>x/180*(11*Math.sin(x/31-t)+3*Math.sin(x/17-t*.75));
   const xx=x=>48+x*(1-.025*Math.sin(t*.9)*x/180);
   const point=(x,b)=>xx(x).toFixed(2)+' '+(23+b+wave(x)).toFixed(2);
   function area(a,b){
    let path='M'+point(0,a);
    for(let x=6;x<=180;x+=6)path+='L'+point(x,a);
    for(let x=180;x>=0;x-=6)path+='L'+point(x,b);
    return path+'Z';
   }
   stripes.forEach((p,i)=>p.setAttribute('d',area(i*40,(i+1)*40)));
   outline.setAttribute('d',area(0,120));
   wheel.setAttribute('transform','translate('+point(90,60)+') skewY('+(Math.atan((wave(91)-wave(89))/2)*180/Math.PI).toFixed(2)+')');
   folds.setAttribute('gradientTransform','translate('+((t*25)%100).toFixed(2)+' 0)');
  }
  raf=requestAnimationFrame(frame);
 }
 function sync(){if(raf!==null)cancelAnimationFrame(raf);raf=null;if(!stopped&&d.open&&!document.hidden&&!motion.matches)raf=requestAnimationFrame(frame);}
 document.addEventListener('visibilitychange',sync);motion.addEventListener?.('change',sync);sync();
 return ()=>{stopped=true;if(raf!==null)cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',sync);motion.removeEventListener?.('change',sync);};
}
function clearTimer(){clearTimeout(timer);timer=null;}
function schedule(ms){clearTimer();if(isActive()&&!seen()&&!document.hidden)timer=setTimeout(attempt,ms);}
function attempt(){
 timer=null;if(!isActive()||seen())return;
 if(!canShow(document,location)){schedule(2000);return;}
 const d=document.createElement('dialog');if(typeof d.showModal!=='function')return;
 d.className='constitution-day-popup';d.setAttribute('aria-labelledby','cd-title');d.setAttribute('aria-describedby','cd-copy');
 d.innerHTML='<button class="cd-close" type="button" aria-label="Close Constitution Day greeting">×</button><p class="cd-brand">SATHIVO</p>'+svgMarkup+
 '<p class="cd-date">26 NOVEMBER 2026</p><h2 id="cd-title">Happy Constitution Day!</h2><p class="cd-subtitle">Samvidhan Diwas</p>'+
 '<div class="cd-divider" aria-hidden="true"></div><p id="cd-copy">Celebrating <strong class="cd-equality">equality</strong>, <strong class="cd-dignity">dignity</strong>, <strong class="cd-freedom">freedom</strong> and <strong class="cd-respect">respect</strong> for everyone.</p>'+
 '<p class="cd-team">With love, Team Sathivo ❤️</p><button type="button" class="cd-continue">Continue to Sathivo</button>';
 const previous=document.activeElement;
 const close=()=>{if(d.open)d.close();};
 d.querySelector('.cd-close').addEventListener('click',close);
 d.querySelector('.cd-continue').addEventListener('click',close);
 d.addEventListener('cancel',e=>{e.preventDefault();close();});
 d.addEventListener('click',e=>{if(e.target===d)close();});
 d.addEventListener('close',()=>{stopFlag?.();stopFlag=null;clearTimeout(expiry);dialog=null;d.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
 document.body.append(d);
 try{d.showModal();dialog=d;remember();expiry=setTimeout(close,Math.max(0,END-Date.now()));stopFlag=animateFlag(d);}
 catch{if(d.open)d.close();else d.remove();}
}
function init(){
 if(!isActive()||seen())return;
 schedule(DELAY);
 document.addEventListener('visibilitychange',()=>{
  if(!isActive()){if(dialog?.open)dialog.close();clearTimer();return;}
  if(document.hidden){clearTimer();return;}
  if(!dialog&&!seen()&&timer===null)schedule(DELAY);
 });
 window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue==='1'){clearTimer();if(dialog?.open)dialog.close();}});
 window.addEventListener('pagehide',()=>{clearTimer();if(dialog?.open)dialog.close();});
 window.addEventListener('pageshow',e=>{if(e.persisted&&!dialog&&!seen())schedule(DELAY);});
}
if(typeof document!=='undefined'&&typeof window!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}
