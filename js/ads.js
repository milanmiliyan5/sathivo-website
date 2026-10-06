import {adsConfig} from './ads-config.js?v=20261006-1';

const labels={
  'home-mid':'Home feed',
  'directory-top':'Companion directory',
  'directory-inline':'Companion feed',
  'bookings-top':'Bookings',
  'booking-confirm':'Booking confirmation'
};

function ensureAdStyles(){
  if(document.getElementById('sathivo-ad-styles'))return;
  const style=document.createElement('style');
  style.id='sathivo-ad-styles';
  style.textContent=`
    .ad-slot{width:100%;min-width:0}
    .ad-slot-inline{grid-column:1/-1}
    .ad-slot-test{min-height:96px;margin:22px auto;padding:14px 18px;border:1px dashed #cda9b8;border-radius:16px;background:linear-gradient(135deg,#fff9fb,#f8edf2);display:flex!important;align-items:center;justify-content:center;gap:14px;text-align:left;color:var(--ink);box-shadow:0 8px 22px rgba(83,35,58,.04)}
    .ad-slot-large.ad-slot-test{min-height:180px;padding:24px}
    .ad-test-badge{flex:0 0 auto;padding:5px 8px;border-radius:999px;background:#6f2b55;color:#fff;font-size:.58rem;font-weight:800;letter-spacing:.08em}
    .ad-test-body{display:grid;gap:2px}
    .ad-test-body strong{font-size:.84rem}
    .ad-test-body small{font-size:.67rem;color:var(--muted);line-height:1.45}
    .booking-confirmation{margin:20px 0 8px;padding:18px 20px;border:1px solid #dcb8c7;border-radius:16px;background:#fff8fb}
    .booking-confirmation strong{display:block;margin-bottom:4px;color:var(--plum)}
    .booking-confirmation p{margin:0;color:var(--muted);font-size:.84rem}
    @media(max-width:640px){
      .ad-slot-test{min-height:82px;margin:16px 0;padding:12px 13px;gap:10px;border-radius:13px}
      .ad-slot-large.ad-slot-test{min-height:150px;padding:18px 14px}
      .ad-test-body strong{font-size:.78rem}
      .ad-test-body small{font-size:.62rem}
      .booking-confirmation{padding:15px;margin-top:16px}
    }
  `;
  document.head.append(style);
}

function renderTestAd(slot){
  const where=labels[slot.dataset.adSlot]||'Sathivo';
  slot.hidden=false;
  slot.classList.add('ad-slot-test');
  if(slot.dataset.adSlot==='booking-confirm')slot.classList.add('ad-slot-large');
  slot.setAttribute('aria-label','Test advertisement placement');
  slot.replaceChildren();

  const badge=document.createElement('span');
  badge.className='ad-test-badge';
  badge.textContent='TEST AD';

  const body=document.createElement('div');
  body.className='ad-test-body';

  const title=document.createElement('strong');
  title.textContent=slot.dataset.adSlot==='booking-confirm'?'Large advertisement space':'Advertisement space';

  const copy=document.createElement('small');
  copy.textContent=where+' · Preview only — no real ad is being served.';

  body.append(title,copy);
  slot.append(badge,body);
  slot.dataset.adMounted='test';
}

function renderLiveAd(slot){
  const key=slot.dataset.adSlot||'';
  const unitId=adsConfig.slots?.[key]||'';
  if(!adsConfig.publisherId||!unitId){slot.hidden=true;return}

  slot.hidden=false;
  slot.classList.remove('ad-slot-test');
  if(key==='booking-confirm')slot.classList.add('ad-slot-large');
  slot.replaceChildren();

  const ins=document.createElement('ins');
  ins.className='adsbygoogle';
  ins.style.display='block';
  ins.dataset.adClient=adsConfig.publisherId;
  ins.dataset.adSlot=unitId;
  ins.dataset.adFormat='auto';
  ins.dataset.fullWidthResponsive='true';
  slot.append(ins);
  slot.dataset.adMounted='live';

  try{
    (globalThis.adsbygoogle=globalThis.adsbygoogle||[]).push({});
  }catch(error){
    console.warn('Sathivo ad slot could not initialize',key,error);
  }
}

export function mountAdSlot(slot){
  if(!(slot instanceof HTMLElement)||slot.dataset.adMounted)return;
  ensureAdStyles();
  if(!adsConfig.enabled){slot.hidden=true;slot.dataset.adMounted='disabled';return}
  if(adsConfig.testMode){renderTestAd(slot);return}
  renderLiveAd(slot);
}

export function mountAds(root=document){
  if(root instanceof HTMLElement&&root.matches('[data-ad-slot]'))mountAdSlot(root);
  root.querySelectorAll?.('[data-ad-slot]').forEach(mountAdSlot);
}

ensureAdStyles();
mountAds();

const observer=new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node instanceof HTMLElement)mountAds(node);
    }
  }
});
observer.observe(document.documentElement,{childList:true,subtree:true});
