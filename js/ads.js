import {adsConfig} from './ads-config.js?v=20261004-2';

const labels={
  'home-mid':'Home feed',
  'directory-top':'Companion directory',
  'bookings-top':'Bookings'
};

function renderTestAd(slot){
  const where=labels[slot.dataset.adSlot]||'Sathivo';
  slot.hidden=false;
  slot.classList.add('ad-slot-test');
  slot.setAttribute('aria-label','Test advertisement placement');
  slot.replaceChildren();

  const badge=document.createElement('span');
  badge.className='ad-test-badge';
  badge.textContent='TEST AD';

  const body=document.createElement('div');
  body.className='ad-test-body';

  const title=document.createElement('strong');
  title.textContent='Advertisement space';

  const copy=document.createElement('small');
  copy.textContent=where+' · Preview only — no real ad is being served.';

  body.append(title,copy);
  slot.append(badge,body);
}

document.querySelectorAll('[data-ad-slot]').forEach(slot=>{
  if(!adsConfig.enabled){slot.hidden=true;return}
  if(adsConfig.testMode){renderTestAd(slot);return}
  if(!adsConfig.publisherId){slot.hidden=true;return}

  slot.hidden=false;
  slot.classList.remove('ad-slot-test');
  slot.textContent='Advertisement';
});
