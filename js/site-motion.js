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