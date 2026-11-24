/* Temporary Sathivo email maintenance notice; expires 25 Nov 2026, 06:00 IST. */
(() => {
  'use strict';
  const end = Date.parse('2026-11-25T06:00:00+05:30');
  if (Date.now() >= end || window.__sathivoEmailMaintenanceLoaded) return;
  window.__sathivoEmailMaintenanceLoaded = true;
  const key = 'sathivo.email-maintenance.dismissed.20261125';
  let dismissed = false, modal, style, timer, expiry;
  try {
    const internal = document.referrer && new URL(document.referrer).origin === location.origin;
    if (!internal && performance.getEntriesByType('navigation')[0]?.type !== 'back_forward') sessionStorage.removeItem(key);
    dismissed = sessionStorage.getItem(key) === '1';
  } catch {}
  function clear() {
    clearTimeout(timer); clearTimeout(expiry);
    if (modal?.open) modal.close();
    modal?.remove(); style?.remove(); modal = undefined; style = undefined;
  }
  function dismiss() {
    dismissed = true;
    try { sessionStorage.setItem(key, '1'); } catch {}
    clear();
  }
  function show() {
    if (dismissed || Date.now() >= end) { clear(); return; }
    if (modal?.open) return;
    // Never bypass or cover an existing mandatory account safety warning.
    if (!document.body || document.querySelector('.sathivo-warning-gate[open]')) {
      timer = setTimeout(show, 250); return;
    }
    style = document.createElement('style');
    style.textContent = [
      '#sathivo-email-maintenance{box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(440px,calc(100% - 28px));max-width:none;max-height:calc(100% - 28px);max-height:calc(100dvh - 28px);padding:26px 24px 22px;border:1px solid #eae2f6;border-radius:24px;background:#fff;color:#292036;box-shadow:0 22px 80px #25143e44;text-align:center;overflow:auto;overscroll-behavior:contain;font:15px/1.5 system-ui,sans-serif;animation:sem-in .28s ease-out}',
      '#sathivo-email-maintenance::backdrop{background:#20172c80;backdrop-filter:blur(4px)}',
      '#sathivo-email-maintenance *{box-sizing:border-box}',
      '#sathivo-email-maintenance .sem-close{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:50%;background:#f5f2f8;color:#554961;font:26px/1 system-ui;cursor:pointer}',
      '#sathivo-email-maintenance .sem-icon{display:block;width:78px;height:78px;margin:0 auto 12px;animation:sem-icon 2.3s ease-in-out infinite}',
      '#sathivo-email-maintenance h2{font:750 clamp(20px,5vw,25px)/1.24 system-ui;margin:0 0 12px;color:#292036;letter-spacing:-.5px}',
      '#sathivo-email-maintenance p{font:400 14px/1.55 system-ui;margin:0 0 12px;color:#655d70}',
      '#sathivo-email-maintenance .sem-time{display:grid;gap:3px;padding:14px 10px;margin:16px 0;border:1px solid #e9e0fa;border-radius:15px;background:#f5f0ff;color:#655d70}',
      '#sathivo-email-maintenance .sem-time small{font-size:10px;font-weight:750;letter-spacing:.09em}',
      '#sathivo-email-maintenance .sem-time strong{font-size:25px;line-height:1.2;color:#7050c9}',
      '#sathivo-email-maintenance .sem-continue{display:block;width:100%;min-height:48px;margin:15px 0 13px;padding:10px;border:0;border-radius:12px;background:#7050c9;color:#fff;font:650 15px/1.4 system-ui;cursor:pointer}',
      '#sathivo-email-maintenance button:focus-visible{outline:3px solid #b5a0ed;outline-offset:3px}',
      '#sathivo-email-maintenance .sem-team{display:block;font-size:14px;font-weight:750;color:#292036}',
      '#sathivo-email-maintenance .sem-tag{display:block;font-size:11px;color:#655d70;margin-top:3px}',
      '@keyframes sem-in{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}',
      '@keyframes sem-icon{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
      '@media(max-height:600px){#sathivo-email-maintenance{padding:18px}#sathivo-email-maintenance .sem-icon{width:55px;height:55px;margin-bottom:8px}#sathivo-email-maintenance .sem-time{margin:10px 0;padding:10px}}',
      '@media(prefers-reduced-motion:reduce){#sathivo-email-maintenance,#sathivo-email-maintenance .sem-icon{animation:none}}'
    ].join('');
    document.head.append(style);
    modal = document.createElement('dialog');
    modal.id = 'sathivo-email-maintenance';
    modal.setAttribute('aria-labelledby','sem-title');
    modal.setAttribute('aria-describedby','sem-description');
    modal.innerHTML =
      '<button class="sem-close" type="button" aria-label="Close maintenance notice">×</button>'+
      '<svg class="sem-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="48" fill="#f0ebff"/><g fill="#7654ce"><rect x="21" y="25" width="56" height="13" rx="4"/><rect x="21" y="42" width="56" height="13" rx="4"/><rect x="21" y="59" width="56" height="13" rx="4"/></g><g fill="#fff"><circle cx="29" cy="31.5" r="2"/><circle cx="29" cy="48.5" r="2"/><circle cx="29" cy="65.5" r="2"/></g><g stroke="#ddd0ff" stroke-width="2" stroke-linecap="round"><path d="M61 31.5h8M61 48.5h8M61 65.5h8"/></g><circle cx="76" cy="73" r="16" fill="#fff"/><circle cx="76" cy="73" r="13" fill="#e7a33d"/><path d="M76 65v8l5 3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'+
      '<h2 id="sem-title">Sathivo Service Maintenance</h2>'+
      '<p id="sem-description">We are currently experiencing a temporary interruption to our email services.</p>'+
      '<p>During this period, new account registration, OTP verification and password reset emails may be temporarily unavailable.</p>'+
      '<div class="sem-time"><small>EXPECTED SERVICE RESTORATION</small><strong>06:00 AM IST</strong><span>25 November 2026</span></div>'+
      '<p>We sincerely apologize for the inconvenience and appreciate your patience and understanding.</p>'+
      '<button class="sem-continue" type="button" autofocus>Continue Exploring</button>'+
      '<span class="sem-team">Team Sathivo</span><span class="sem-tag">Connecting people, creating meaningful moments.</span>';
    modal.querySelector('.sem-close').addEventListener('click', dismiss);
    modal.querySelector('.sem-continue').addEventListener('click', dismiss);
    modal.addEventListener('cancel', e => { e.preventDefault(); dismiss(); });
    document.body.append(modal);
    try {
      modal.showModal();
      modal.style.setProperty('display','block','important');
    } catch { clear(); return; }
    expiry = setTimeout(clear, Math.max(0, end - Date.now()));
  }
  function schedule() {
    if (Date.now() >= end) { clear(); return; }
    if (!dismissed && !modal?.open) {
      clearTimeout(timer);
      timer = setTimeout(show, Math.max(0, 1200 - performance.now()));
    }
  }
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  schedule();
})();

(() => {
  const body=document.body;
  if(!body.classList.contains('sathivo-2d') || body.classList.contains('home-2d')) return;

  const selectors=[
    '.page-head','.legal-hero','.launch-note','.payment-note','.filters',
    '.profile-layout>aside','.profile-card','.account-story','.account-card',
    '.booking-form','.detail-card','.legal-summary','.legal-callout','.legal-panel',
    '.companion-card','.booking-card','.chat-list-card','.notification-card','.request-card',
    '.empty-state','.profile-system-card','.push-settings-card','.legal-section',
    '.safety-actions'
  ];

  const seen=new WeakSet();
  const observer=('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    ? new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(!entry.isIntersecting) return;
          entry.target.classList.add('site-visible');
          observer.unobserve(entry.target);
        });
      },{threshold:.1,rootMargin:'0px 0px -5% 0px'})
    : null;

  function decorate(root=document){
    let count=0;
    selectors.forEach((selector,selectorIndex)=>{
      const nodes=[];
      if(root.nodeType===1 && root.matches?.(selector)) nodes.push(root);
      root.querySelectorAll?.(selector).forEach(el=>nodes.push(el));
      nodes.forEach(el=>{
        if(seen.has(el)) return;
        seen.add(el);
        const dir=(selectorIndex+count)%3===0?'left':((selectorIndex+count)%3===2?'right':'up');
        el.dataset.siteSlide=dir;
        el.style.setProperty('--site-slide-delay',Math.min((count%5)*55,220)+'ms');
        count++;
        if(observer) observer.observe(el); else el.classList.add('site-visible');
      });
    });
  }

  body.classList.add('site-motion-ready');
  decorate();

  const mutation=new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType===1) decorate(node);
    }));
  });
  mutation.observe(document.body,{childList:true,subtree:true});
})();