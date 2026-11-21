// Pure helpers, shared by the dashboard and regression tests.
export const sidebarBadgeSections=Object.freeze({
  'users-section':'users',
  'bookings-section':'bookings',
  'support-section':'support',
  'feedback-section':'feedback',
  'contributions-section':'contributions',
  'reports-section':'reports',
});
export const sidebarReadAcknowledgements=Object.freeze(['users','bookings','contributions']);
export function safeBadgeCount(value){
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>0?n:0;
}
export function badgeLabel(value){
  const n=safeBadgeCount(value);
  return n>99?'99+':String(n);
}
export function updateSidebarBadges(root,counts){
  for(const [section,key] of Object.entries(sidebarBadgeSections)){
    const anchor=root.querySelector('.sidebar-link[data-section="'+section+'"]');
    if(!anchor)continue;
    const badge=anchor.querySelector('.sidebar-count');
    if(!badge)continue;
    const count=safeBadgeCount(counts?.[key]);
    anchor.dataset.badgeCount=String(count);
    badge.hidden=count===0;
    badge.textContent=count?badgeLabel(count):'';
    if(count)anchor.setAttribute('aria-label',anchor.querySelector('.sidebar-text').textContent.trim()+', '+count+' new');
    else anchor.removeAttribute('aria-label');
  }
}
