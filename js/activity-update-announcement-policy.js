// Pure, testable guards for the one-time 21-activity announcement.
export const ACTIVITY_ANNOUNCEMENT_DELAY_MS=5000;
export const ACTIVITY_ANNOUNCEMENT_TARGET='profile.html#your-kind-of-company';

export function canShowActivityAnnouncement(doc,locationInfo){
 if(!doc||doc.hidden||doc.visibilityState==='hidden')return false;
 const hash=String(locationInfo?.hash||'');
 // Do not interrupt deep links or the login/signup/reset-password flows.
 if(hash&&hash!=='#account')return false;
 if(doc.querySelector('dialog[open],.mobile-header-menu[open],form[aria-busy="true"],[data-updating="true"]'))return false;
 if(doc.body?.classList.contains('modal-open')||doc.body?.classList.contains('auth-pending'))return false;
 if(doc.activeElement?.matches?.('input,textarea,select,[contenteditable="true"],button[disabled]'))return false;
 return true;
}
