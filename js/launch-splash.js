/* Sathivo Android's hand-drawn heart and original colors.
   Place as the first body script so the website is already rendered behind it.
   Shown once per tab session, with cleanup even if animations fail. */
(()=>{
 'use strict';
 const SEEN='sathivo.launch-splash.seen.v1';
 const durationMs=2200;
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 if(!document.body)return;
 try{
  if(sessionStorage.getItem(SEEN)==='1')return;
  sessionStorage.setItem(SEEN,'1');
 }catch{/* Blocked storage must never block loading. */}
 const screen=document.createElement('div');
 screen.className='sathivo-launch-screen';
 screen.setAttribute('aria-hidden','true');
 screen.innerHTML=`
  <span class="sathivo-launch-screen__oval sathivo-launch-screen__oval--top-right"></span>
  <span class="sathivo-launch-screen__oval sathivo-launch-screen__oval--left"></span>
  <span class="sathivo-launch-screen__oval sathivo-launch-screen__oval--bottom-right"></span>
  <span class="sathivo-launch-screen__oval sathivo-launch-screen__oval--bottom-left"></span>
  <div class="sathivo-launch-screen__content">
   <svg class="sathivo-launch-screen__heart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 100" focusable="false" aria-hidden="true">
    <path class="sathivo-launch-screen__stroke--one" pathLength="1" d="M47 21 C33 -2 8 8 8 27 C8 42 27 59 48 77 L70 55"/>
    <path class="sathivo-launch-screen__stroke--two" pathLength="1" d="M92 25 C91 2 59 1 55 21 C50 41 75 43 86 54 C106 76 78 95 58 81"/>
   </svg>
   <div class="sathivo-launch-screen__name">Sathivo</div>
   <div class="sathivo-launch-screen__tagline">Find your kind of company.</div>
  </div>`;
 document.body.prepend(screen);
 let removed=false;
 let fallback;
 const remove=()=>{
  if(removed)return;
  removed=true;
  clearTimeout(fallback);
  screen.remove();
 };
 screen.addEventListener('animationend',event=>{
  if(event.target===screen&&event.animationName==='sathivo-splash-dissolve')remove();
 });
 fallback=setTimeout(remove,durationMs+500);
 window.addEventListener('pagehide',remove,{once:true});
})();
