/* Sathivo Android's hand-drawn heart and original colors.
   Place as the first body script so the website is already rendered behind it.
   Shown once per tab session, with cleanup even if animations fail. */
(()=>{
 'use strict';
 const SEEN='sathivo.launch-splash.seen.v1';
 const HANDOFF='sathivo.launch-splash.handoff.v1';
 const durationMs=2200;
 const root=document.documentElement;
 if(!document.body)return;
 let handoff=null;
 try{
  const raw=sessionStorage.getItem(HANDOFF);
  if(raw){
   sessionStorage.removeItem(HANDOFF);
   const candidate=JSON.parse(raw);
   const now=Date.now();
   if(candidate.path===location.pathname&&Number.isFinite(candidate.started)&&Number.isFinite(candidate.issued)&&now>=candidate.issued&&now-candidate.issued<10000&&candidate.started<=candidate.issued&&candidate.issued-candidate.started<10000)handoff=candidate;
  }
 }catch{}
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const externalEntry=root.classList.contains('sathivo-entry-launch');
 const pending=()=>root.classList.contains('sathivo-entry-pending');
 try{
  if(!externalEntry&&!handoff&&sessionStorage.getItem(SEEN)==='1')return;
  sessionStorage.setItem(SEEN,'1');
 }catch{/* Blocked storage must never block loading. */}
 const started=handoff?.started??Date.now();
 if(externalEntry)window.__sathivoEntrySplashStartedAt=started;
 // Continue the same artwork on the destination; retain a short fade even if
 // authentication or navigation took longer than the nominal splash duration.
 const elapsed=()=>Math.max(0,Math.min(1200,Date.now()-started));
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
 if(handoff)screen.style.setProperty('--sathivo-splash-elapsed',elapsed()+'ms');
 document.body.prepend(screen);
 let removed=false;
 let fallback,observer;
 const remove=()=>{
  if(removed)return;
  removed=true;
  clearTimeout(fallback);
  observer?.disconnect();
  screen.remove();
 };
 screen.addEventListener('animationend',event=>{
  if(event.target===screen&&event.animationName==='sathivo-splash-dissolve'&&!pending())remove();
 });
 const armFade=()=>{
  screen.style.setProperty('--sathivo-splash-fade-elapsed',elapsed()+'ms');
  fallback=setTimeout(remove,durationMs-elapsed()+500);
 };
 if(pending()){
  // Hold the branded splash above hidden Home while resolving the route.
  // On a failed/expired session the existing seven-second fallback reveals Home.
  observer=new MutationObserver(()=>{
   if(pending())return;
   observer.disconnect();armFade();
  });
  observer.observe(root,{attributes:true,attributeFilter:['class']});
 }else if(handoff){
  armFade();
 }else{
  fallback=setTimeout(remove,durationMs+500);
 }
 window.addEventListener('pagehide',remove,{once:true});
})();
