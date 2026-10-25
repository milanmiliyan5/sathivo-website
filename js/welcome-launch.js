import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';

// First-time visitor welcome for public Sathivo landing pages.
// No user data is sent or collected; browser storage only remembers dismissal.
const SHOWN_KEY='sathivo.launch-welcome.shown.v1';
const DISMISSED_KEY='sathivo.launch-welcome.dismissed-until.v1';
const REAPPEAR_AFTER_MS=7*24*60*60*1000;
const DISPLAY_DELAY_MS=3800;

function storageRead(storage,key){
  try{return storage.getItem(key)}catch{return null}
}
function storageWrite(storage,key,value){
  try{storage.setItem(key,value)}catch{}
}
function dismissForAWeek(){
  storageWrite(sessionStorage,SHOWN_KEY,'1');
  storageWrite(localStorage,DISMISSED_KEY,String(Date.now()+REAPPEAR_AFTER_MS));
}

async function isSignedIn(){
  try{
    const client=await getSathivoClient();
    const {data,error}=await client.auth.getSession();
    return !error && Boolean(data?.session);
  }catch{
    // If the auth service is temporarily unavailable, the welcome may still
    // appear; it never exposes any signed-in member data.
    return false;
  }
}

function createWelcome(){
  const dialog=document.createElement('dialog');
  dialog.className='launch-welcome';
  dialog.id='launch-welcome';
  dialog.setAttribute('aria-labelledby','launch-welcome-title');
  dialog.setAttribute('aria-describedby','launch-welcome-description');
  dialog.innerHTML=[
    '<div class="launch-welcome-inner">',
      '<button type="button" class="launch-welcome-close" aria-label="Close welcome message">×</button>',
      '<div class="launch-welcome-top">',
        '<span class="launch-welcome-brand"><span class="launch-welcome-heart" aria-hidden="true">♡</span> Sathivo</span>',
        '<span class="launch-welcome-tag">JUST LAUNCHED ✨</span>',
      '</div>',
      '<div class="launch-welcome-intro">',
        '<span class="launch-welcome-kicker">REAL COMPANY. REAL MOMENTS.</span>',
        '<h2 id="launch-welcome-title">We’re New.<br><em>Let’s Grow Together!</em></h2>',
        '<p id="launch-welcome-description">Sathivo has just launched across India. Be among the first to help our community grow — your first step matters!</p>',
      '</div>',
      '<div class="launch-welcome-options">',
        '<a class="launch-welcome-option launch-welcome-find" href="companions.html">',
          '<span class="launch-welcome-option-icon" aria-hidden="true">☕</span>',
          '<span><strong>Find a Companion</strong><small>Look for company for coffee, movies, shopping or a chat in your city.</small></span>',
          '<span class="launch-welcome-arrow" aria-hidden="true">↗</span>',
        '</a>',
        '<a class="launch-welcome-option launch-welcome-earn" href="account.html#signup">',
          '<span class="launch-welcome-option-icon" aria-hidden="true">₹</span>',
          '<span><strong>Become a Companion</strong><small>Join for free, make your profile, set your rate and receive requests.</small></span>',
          '<span class="launch-welcome-arrow" aria-hidden="true">↗</span>',
        '</a>',
      '</div>',
      '<p class="launch-welcome-community-note">We’re building city by city. Profile availability and earnings depend on members and bookings.</p>',
      '<div class="launch-welcome-footer">',
        '<span>Free to join · 18+ only · Strictly platonic</span>',
        '<button type="button" class="launch-welcome-later">Maybe later</button>',
      '</div>',
    '</div>'
  ].join('');
  document.body.append(dialog);

  dialog.querySelector('.launch-welcome-close')?.addEventListener('click',()=>dialog.close());
  dialog.querySelector('.launch-welcome-later')?.addEventListener('click',()=>dialog.close());
  dialog.querySelectorAll('.launch-welcome-option').forEach(link=>{
    link.addEventListener('click',dismissForAWeek);
  });
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    dismissForAWeek();
    document.body.classList.remove('launch-welcome-open');
  });

  return dialog;
}

async function init(){
  if(storageRead(sessionStorage,SHOWN_KEY)==='1')return;
  const dismissedUntil=Number(storageRead(localStorage,DISMISSED_KEY)||0);
  if(dismissedUntil>Date.now())return;

  // Do not interrupt links to a section, or members already using Sathivo.
  if(window.location.hash)return;
  if(await isSignedIn())return;

  await new Promise(resolve=>setTimeout(resolve,DISPLAY_DELAY_MS));
  if(document.visibilityState!=='visible'||document.querySelector('dialog[open]')||
     document.body.classList.contains('modal-open')||
     document.activeElement?.matches('input,textarea,select,[contenteditable]'))return;

  const welcome=createWelcome();
  if(typeof welcome.showModal!=='function')return;
  try{
    welcome.showModal();
    document.body.classList.add('launch-welcome-open');
    storageWrite(sessionStorage,SHOWN_KEY,'1');
  }catch{
    welcome.remove();
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>void init(),{once:true});
}else{
  void init();
}
