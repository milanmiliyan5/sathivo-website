import {avatarAsset} from './avatar-utils.js?v=20261121-avatars-1';
import {startFeedbackPrompt,stopFeedbackPrompt} from './feedback-prompt.js?v=20261119-feedback-1';
import { authConfig } from './auth-config.js?v=20260926-1';
import { createAuthFlow } from './auth-flow.js?v=20261027-nearbyconsent-1';
import { createAuthFetch } from './auth-transport.js?v=20260926-1';
import { getSathivoClient, ensureSupabaseSdk, onAuthTransport } from './supabase-client.js?v=20261025-polish-1';

const panels = [...document.querySelectorAll('[data-panel]')];
const tabs = document.querySelector('#account-tabs');
const status = document.querySelector('#account-status');
const notice = document.querySelector('#launch-notice');
const resendButton = document.querySelector('#resend-code');
const signoutButton = document.querySelector('#signout');
const publicRoutes = new Set(['login', 'signup', 'forgot', 'verify-email']);
let flow = null;
let busy = false;
let activePanel = 'login';
let appClient = null;
let accountEpoch=0, accountView='home', accountViewStack=[];
let accountRecovery=false;
let previewSequence=0,previewData=null,previewModule=null;
const accountViewNames=new Set(['home','settings','notifications','nearby','privacy','public-preview']);
function readAccountHistory(state){
 const entry=state?.sathivoAccount;
 if(!entry||!Array.isArray(entry.stack)||!accountViewNames.has(entry.view))return null;
 if(entry.stack.length>8||!entry.stack.every(name=>accountViewNames.has(name)))return null;
 if(entry.view==='home'&&entry.stack.length)return null;
 if(entry.view!=='home'&&entry.stack[0]!=='home')return null;
 return {view:entry.view,stack:[...entry.stack]};
}
const initialAccountHistory=location.hash==='#account'?readAccountHistory(history.state):null;
let restoredAccountHistory=false, accountBackPending=false, accountRecoveryUser=null;
function writeAccountHistory(mode='replaceState'){
 history[mode]({sathivoAccount:{view:accountView,stack:[...accountViewStack]}},'', '#account');
}
function restoreAccountHistory(entry,{focus=true}={}){
 accountViewStack=[...entry.stack];
 showAccountView(entry.view,{focus});
}

// Only allow known relative booking email destinations, never external URLs.
// Capture the query before the account page strips it for auth safety.
const emailBookingReturnRoute=(()=>{
  try {
    const candidate=new URL(location.href).searchParams.get('next')||'';
    return /^(?:chat\.html\?booking=|requests\.html\?id=|bookings\.html\?id=)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)?candidate:'';
  } catch { return ''; }
})();

document.querySelector('#account-year').textContent = new Date().getFullYear();

function announce(message = '', tone = 'info', focus = false) {
  status.textContent = message;
  status.dataset.tone = tone;
  if (focus && message) status.focus();
}

function clearSecrets() {
  document.querySelectorAll('input[name="password"], input[name="confirmation"], #otp-code').forEach(input => {
    input.value = '';
    if (input.id !== 'otp-code') input.type = 'password';
  });
  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.textContent = 'Show';
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('aria-pressed', 'false');
  });
}

function showPanel(name, { focus = true } = {}) {
  if (!panels.some(panel => panel.dataset.panel === name)) name = 'login';
  activePanel = name;
  document.body.classList.toggle('account-hub-active',name==='account');
  if(name==='account'){accountViewStack=[];showAccountView('home',{focus:false});}
  else{accountEpoch++;clearPublicPreview();delete document.body.dataset.accountView;stopFeedbackPrompt();}
  const recoveryBack=document.querySelector('#account-recovery-back');
  if(recoveryBack)recoveryBack.hidden=!(name==='forgot'&&accountRecovery);
  panels.forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
  tabs.hidden = ['otp', 'new-password', 'account'].includes(name);
  tabs.querySelectorAll('a').forEach(link => {
    if (link.dataset.route === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if(name==='account')writeAccountHistory();
  else history.replaceState(null, '', '#' + name);
  announce();
  if (focus) document.querySelector(`[data-panel="${name}"] h2`)?.focus();
  updateResend();
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('form fieldset').forEach(fieldset => {
    fieldset.disabled = busy || !flow || !authConfig.accountsEnabled;
  });
  document.querySelectorAll('form').forEach(form => form.setAttribute('aria-busy', String(value)));
  signoutButton.disabled = busy || !flow;
  updateResend();
}

function updateResend() {
  const remaining = flow?.resendSeconds() ?? 0;
  resendButton.disabled = busy || !flow || activePanel !== 'otp' || remaining > 0;
  document.querySelector('#resend-countdown').textContent = activePanel === 'otp' && remaining > 0 ? `Available in ${remaining}s` : '';
  document.querySelectorAll('[data-email-send]').forEach(button => {
    button.disabled = busy || !flow || remaining > 0;
  });
  document.querySelectorAll('[data-email-countdown]').forEach(hint => {
    hint.textContent = remaining > 0 ? `Please wait ${remaining}s before requesting another email. Provider limits may last longer.` : '';
  });
}

function renderOtp(pending) {
  const recovery = pending.kind === 'recovery';
  document.querySelector('#otp-title').textContent = recovery ? 'Check your inbox.' : 'Verify your email.';
  document.querySelector('#otp-explanation').textContent = recovery
    ? 'A password reset code is sent only if this email belongs to an eligible account. Check your inbox and spam folder, then enter the latest code below.'
    : 'Signup codes are sent only while your email is waiting for verification. If you already verified it, sign in with your password instead.';
  document.querySelector('#signup-code-help').hidden = recovery;
  document.querySelector('#otp-destination').textContent = pending.email;
  showPanel('otp');
  clearSecrets();
}

function clearPublicPreview(){
 previewSequence++;previewData=null;
 const empty=document.querySelector('#public-preview-empty');if(empty)empty.hidden=true;
 document.querySelector('#results')?.replaceChildren();
 const actions=document.querySelector('#public-preview-actions');
 if(actions)actions.hidden=true;
 const shareStatus=document.querySelector('#public-preview-share-status');
 if(shareStatus)shareStatus.textContent='';
 const link=document.querySelector('#public-preview-link');
 if(link)link.removeAttribute('href');
 const whatsapp=document.querySelector('#public-preview-whatsapp');
 if(whatsapp)whatsapp.removeAttribute('href');
}
async function refreshPublicPreview(){
 clearPublicPreview();
 const seq=previewSequence,owner=accountRecoveryUser;
 const feedback=document.querySelector('#public-preview-status');
 const retry=document.querySelector('#public-preview-retry');
 retry.hidden=true;feedback.textContent='Loading your public profile…';
 const current=()=>seq===previewSequence&&activePanel==='account'&&accountView==='public-preview'&&accountRecoveryUser?.id===owner?.id;
 if(!owner||!appClient)return;
 try{
  previewModule=await import('./companions-page.js?v=20261124-clean-empty-1');
  if(!current())return;
  const preview=await previewModule.loadOwnPublicPreview(appClient,owner.id);
  if(!current())return;
  if(preview.state!=='public'){
   const copy={
    hidden:['Your profile is hidden','Turn Public Profile on in settings to share your card.'],
    unpublished:['No public profile yet','Publish your companion profile to see your card.'],
    unavailable:['Profile unavailable','Your profile is not currently visible to the public.']
   }[preview.state]||['Profile unavailable','Your profile is not publicly available.'];
   feedback.textContent='';
   document.querySelector('#public-preview-empty-title').textContent=copy[0];
   document.querySelector('#public-preview-empty-copy').textContent=copy[1];
   document.querySelector('#public-preview-empty').hidden=false;
   return;
  }
  previewData=preview;
  document.querySelector('#results').replaceChildren(preview.node);
  feedback.textContent='This is how your card appears to others on Explore.';
  document.querySelector('#public-preview-link').href=preview.url;
  document.querySelector('#public-preview-whatsapp').href='https://wa.me/?text='+encodeURIComponent('See my Sathivo profile: '+preview.url);
  document.querySelector('#public-preview-actions').hidden=false;
 }catch{
  if(!current())return;
  feedback.textContent='Could not load your public profile. Please try again.';
  retry.hidden=false;
 }
}
document.querySelector('#public-preview-retry').onclick=()=>void refreshPublicPreview();
document.querySelector('#public-preview-share').onclick=()=>{
 if(previewData&&previewModule&&accountView==='public-preview')void previewModule.shareProfile(previewData.row,document.querySelector('#public-preview-share'));
};
document.querySelector('#public-preview-copy').onclick=async()=>{
 if(!previewData||accountView!=='public-preview')return;
 const url=previewData.url,seq=previewSequence;
 try{await navigator.clipboard.writeText(url);if(seq===previewSequence)document.querySelector('#public-preview-share-status').textContent='Profile link copied.';}
 catch{window.prompt('Copy your public profile link:',url);}
};
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&activePanel==='account'&&accountView==='public-preview')void refreshPublicPreview();
});
let rankingPreferenceSequence=0;
const rankingPreference=document.querySelector('#tc-opt-out');
const rankingPreferenceStatus=document.querySelector('#tc-pref-status');
async function loadRankingPreference(){
 const sequence=++rankingPreferenceSequence,owner=accountRecoveryUser?.id;
 if(!rankingPreference||!appClient||!owner)return;
 rankingPreference.disabled=true;rankingPreference.checked=false;
 rankingPreferenceStatus.textContent='Loading…';
 try{
  const {data,error}=await appClient.rpc('top_companions_preference',{p_opt_out:null});
  if(sequence!==rankingPreferenceSequence||accountRecoveryUser?.id!==owner||activePanel!=='account'||accountView!=='privacy')return;
  if(error)throw error;
  rankingPreference.checked=data===true;rankingPreference.disabled=false;rankingPreferenceStatus.textContent='';
 }catch{if(sequence===rankingPreferenceSequence&&accountRecoveryUser?.id===owner)rankingPreferenceStatus.textContent='Could not load. Reopen Privacy & Safety to retry.';}
}
rankingPreference?.addEventListener('change',async()=>{
 const sequence=++rankingPreferenceSequence,owner=accountRecoveryUser?.id,wanted=rankingPreference.checked;
 if(!appClient||!owner||activePanel!=='account'||accountView!=='privacy'){rankingPreference.checked=!wanted;return;}
 rankingPreference.disabled=true;rankingPreferenceStatus.textContent='';
 try{
  const {data,error}=await appClient.rpc('top_companions_preference',{p_opt_out:wanted});
  if(sequence!==rankingPreferenceSequence||accountRecoveryUser?.id!==owner)return;
  if(error)throw error;
  rankingPreference.checked=data===true;rankingPreferenceStatus.textContent='Saved.';
 }catch{if(sequence===rankingPreferenceSequence&&accountRecoveryUser?.id===owner){rankingPreference.checked=!wanted;rankingPreferenceStatus.textContent='Could not save. Try again.';}}
 finally{if(sequence===rankingPreferenceSequence&&accountRecoveryUser?.id===owner)rankingPreference.disabled=false;}
});
function showAccountView(name,{focus=true}={}){
  const screens=[...document.querySelectorAll('[data-account-screen]')];
  if(!screens.some(screen=>screen.dataset.accountScreen===name))return;
  accountView=name;
  document.body.dataset.accountView=name;
  screens.forEach(screen=>{screen.hidden=screen.dataset.accountScreen!==name;});
  if(name==='public-preview')void refreshPublicPreview();
  else clearPublicPreview();
  if(name==='privacy'){
    void loadRankingPreference();
    const boundaries=document.querySelector('#account-boundaries');
    if(boundaries)boundaries.open=false;
  }
  if(focus){
    window.scrollTo({top:0,left:0,behavior:'instant'});
    document.querySelector('[data-account-screen="'+name+'"] .account-hub-heading')?.focus({preventScroll:true});
  }
}
document.querySelectorAll('[data-account-open]').forEach(button=>button.addEventListener('click',()=>{
  if(activePanel!=='account'||busy)return;
  const next=button.dataset.accountOpen;
  if(accountBackPending||next===accountView||!accountViewNames.has(next))return;
  accountViewStack.push(accountView);
  showAccountView(next);
  writeAccountHistory('pushState');
}));
document.querySelectorAll('[data-account-back]').forEach(button=>button.addEventListener('click',()=>{
  if(activePanel!=='account'||busy)return;
  if(accountBackPending)return;
  const entry=readAccountHistory(history.state);
  if(entry?.view===accountView&&entry.stack.length){
    accountBackPending=true;history.back();return;
  }
  showAccountView(accountViewStack.pop()||'home');
  writeAccountHistory();
}));
window.addEventListener('popstate',event=>{
  accountBackPending=false;
  const entry=readAccountHistory(event.state);
  if(!entry)return;
  if(activePanel==='account'){restoreAccountHistory(entry);return;}
  if(!accountRecovery||!accountRecoveryUser||busy||!flow)return;
  // Revalidate the existing main session; do not restore any recovery grant.
  const priorUser=accountRecoveryUser;
  void (async()=>{
    try{
      await flow.cancelChallenge();
      clearSecrets();
      const current=await flow.currentUser();
      if(location.hash!=='#account')return;
      if(!current||current.id!==priorUser.id){accountRecovery=false;accountRecoveryUser=null;showPanel('login');return;}
      renderAccount(current);
      restoreAccountHistory(entry);writeAccountHistory();
    }catch{accountRecovery=false;accountRecoveryUser=null;showPanel('login');}
  })();
});

function resetAccountPhoto(name){
  const image=document.querySelector('#account-avatar-photo');
  const initial=document.querySelector('#account-avatar-initial');
  if(initial)initial.textContent=(name||'S').trim().slice(0,1).toUpperCase()||'S';
  if(image){image.hidden=true;image.removeAttribute('src');image.onload=image.onerror=null;}
}
async function refreshAccountActions(user,epoch){
  if(!appClient||!user?.id)return;
  const current=()=>epoch===accountEpoch&&activePanel==='account'&&document.querySelector('#account-email').textContent===(user.email??'');
  try{
    const {data,error}=await appClient.from('member_profiles')
      .select('display_name,avatar_path').eq('user_id',user.id).maybeSingle();
    if(error||!current())return;
    const latestName=typeof data?.display_name==='string'?data.display_name.trim():'';
    if(latestName){document.querySelector('#account-name').textContent=latestName;resetAccountPhoto(latestName);}
    const path=data?.avatar_path;
    let src=avatarAsset(path);
    // Only request a private photo from the signed-in member's own folder.
    if(!src&&typeof path==='string'&&path.startsWith(user.id+'/')){
      const result=await appClient.storage.from('profile-photos').createSignedUrl(path,300);
      if(!result.error)src=result.data?.signedUrl;
    }
    if(!src||!current())return;
    const image=document.querySelector('#account-avatar-photo');
    if(image){
      image.onload=()=>{if(current())image.hidden=false;};
      image.onerror=()=>{image.hidden=true;};
      image.src=src;
    }
  }catch{/* Keep initials and the account navigation usable if the profile is unavailable. */}
}
function renderAccount(user){
  // Metadata is display-only; access controls are unchanged.
  const name=typeof user.user_metadata?.display_name==='string'?user.user_metadata.display_name.trim().slice(0,60):'friend';
  document.querySelector('#account-name').textContent=name||'friend';
  document.querySelector('#account-email').textContent=user.email??'';
  const verification=document.querySelector('#account-email-verification');
  if(verification)verification.textContent=user.email_confirmed_at?'Email verified ✓':'Email verification unavailable';
  resetAccountPhoto(name);
  accountRecovery=false;
  accountRecoveryUser=user;
  showPanel('account',{focus:false});
  if(!restoredAccountHistory&&initialAccountHistory){
    restoreAccountHistory(initialAccountHistory,{focus:false});
    writeAccountHistory();
  }
  restoredAccountHistory=true;
  startFeedbackPrompt(user);
  clearSecrets();
  void refreshAccountActions(user,++accountEpoch);
}

async function run(task, loadingMessage) {
  if (busy) return;
  if (!flow) {
    announce('Accounts are coming soon. You can keep exploring Sathivo while email verification is being prepared.', 'info', true);
    return;
  }
  setBusy(true);
  announce(loadingMessage);
  try { await task(); }
  catch (error) {
    if (error.code === 'recovery_expired') {
      await flow.cancelChallenge();
      showPanel('forgot');
      clearSecrets();
    }
    announce(error.message || 'We could not complete that request. Please try again.', 'error', true);
  } finally { setBusy(false); }
}

function bindForm(id, task, loadingMessage) {
  const form = document.querySelector(id);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    if (!form.reportValidity()) {
      if (id === '#otp-form') announce('Enter the 6-digit code from your email.', 'error', true);
      return;
    }
    // Capture values before the fieldset becomes disabled.
    const values = Object.fromEntries(new FormData(form));
    void run(() => task(values, form), loadingMessage);
  });
}

bindForm('#login-form', async values => {
  await flow.login(values);
  clearSecrets();
  let destination='./?start=1';
  try{
    // Use only a validated local booking destination after sign-in.
    const pending=sessionStorage.getItem('sathivo.returnAfterLogin.v1')||'';
    sessionStorage.removeItem('sathivo.returnAfterLogin.v1');
    const candidate=emailBookingReturnRoute||pending;
    if(/^(?:chat\.html\?booking=|requests\.html\?id=|bookings\.html\?id=)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)) destination=candidate;
  }catch{}
  // The chat page still checks participant permissions server-side.
  window.location.replace(new URL(destination, window.location.href).href);
}, 'Signing you in…');

bindForm('#signup-form', async values => {
  const result = await flow.signup({ ...values, gender: values.gender, adult: values.adult === 'on', boundaries: values.boundaries === 'on', nearbyEmail: values.nearby_email_opt_in === 'on' });
  if (result.kind === 'sign-in') {
    document.querySelector('#login-email').value = result.email;
    showPanel('login');
    clearSecrets();
    announce(result.message, 'info', true);
    return;
  }
  renderOtp(result);
}, 'Preparing your email verification…');

bindForm('#recovery-form', async values => {
  renderOtp(await flow.requestRecovery(values.email));
}, 'Requesting your reset code…');

bindForm('#verification-form', async values => {
  renderOtp(await flow.requestSignupCode(values.email));
}, 'Requesting your verification code…');

bindForm('#otp-form', async values => {
  try {
    const result = await flow.verify(values.code);
    if (result.kind === 'recovery') showPanel('new-password');
    else renderAccount(result.user);
  } finally { document.querySelector('#otp-code').value = ''; }
}, 'Checking your code…');

bindForm('#password-form', async values => {
  const result = await flow.changePassword(values.password, values.confirmation);
  accountRecovery=false;accountRecoveryUser=null;
  clearSecrets();
  showPanel('login');
  announce(result.sessionsRevoked
    ? 'Your password has been changed. Sign in with your new password.'
    : 'Your password has been changed, but we could not confirm sign-out on every device. Sign out on any other devices you use.',
  result.sessionsRevoked ? 'success' : 'info', true);
}, 'Saving your new password…');

resendButton.addEventListener('click', () => void run(async () => {
  await flow.resend();
  document.querySelector('#otp-code').value = '';
  announce(flow.getChallenge()?.kind === 'recovery'
    ? 'Request completed. Eligible accounts receive a reset code; use the latest email and check spam too.'
    : 'Request completed. Already verified? No signup code will be sent. Choose “Sign in with password” or “Forgot password?” above.', 'info', true);
}, 'Requesting another code…'));

signoutButton.addEventListener('click', () => void run(async () => {
  if (typeof window.sathivoPushUnregister === 'function') await window.sathivoPushUnregister();
  await flow.logout();
  accountRecovery=false;accountRecoveryUser=null;
  clearSecrets();
  document.querySelector('#account-name').textContent = 'friend';
  document.querySelector('#account-email').textContent = '';
  showPanel('login');
  announce('You have signed out on this device.', 'success');
}, 'Signing you out…'));

document.querySelectorAll('[data-toggle-password]').forEach(button => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed', String(show));
  });
});

document.querySelectorAll('[data-route]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    if (busy) return;
    if(activePanel==='account'&&link.dataset.route==='forgot'){
      accountRecovery=true;
      history.pushState({sathivoRecovery:true},'', '#forgot');
    }
    const pendingEmail = (activePanel==='account'?document.querySelector('#account-email').textContent.trim():'')
      || flow?.getChallenge()?.email
      || (activePanel === 'signup' ? document.querySelector('#signup-email').value.trim() : '')
      || (activePanel === 'login' ? document.querySelector('#login-email').value.trim() : '');
    if (pendingEmail && link.dataset.route === 'login') document.querySelector('#login-email').value = pendingEmail;
    if (pendingEmail && link.dataset.route === 'forgot') document.querySelector('#recovery-email').value = pendingEmail;
    if (pendingEmail && link.dataset.route === 'verify-email') document.querySelector('#verification-email').value = pendingEmail;
    clearSecrets();
    // Immediately clear the recovery grant before changing screens.
    if (flow) void flow.cancelChallenge();
    showPanel(link.dataset.route);
    if(accountRecovery&&link.dataset.route==='forgot')window.scrollTo({top:0,left:0,behavior:'instant'});
  });
});

window.addEventListener('hashchange', () => {
  const name = location.hash.slice(1);
  if (name === 'account-boundaries') {
    if(activePanel==='account'){
      if(accountView!=='privacy'){accountViewStack.push(accountView);showAccountView('privacy',{focus:false});}
      writeAccountHistory();
    }
    document.querySelector('#account-boundaries').open = true;
    return;
  }
  if(name==='account'&&readAccountHistory(history.state)&&(activePanel==='account'||accountRecovery))return;
  if (busy) { history.replaceState(null, '', '#' + activePanel); return; }
  if (!publicRoutes.has(name)) { history.replaceState(null, '', '#' + activePanel); return; }
  if (flow) void flow.cancelChallenge();
  clearSecrets();
  showPanel(name);
});

// The application accepts typed OTPs only. Never restore sessions from a URL.
const initialRoute = location.hash.slice(1);
const hadTokenUrl = /access_token|refresh_token|token_hash|[?&]code=/.test(location.hash + location.search);
if (location.search || hadTokenUrl) history.replaceState(null, '', location.pathname + '#login');
showPanel(publicRoutes.has(initialRoute) ? initialRoute : 'login', { focus: false });
if (hadTokenUrl) announce('Use the verification code from your email on this page. Request a fresh code to continue.', 'info');

async function initialize() {
  if (!authConfig.accountsEnabled) {
    notice.textContent = 'Accounts are temporarily unavailable. Please try again later.';
    document.body.classList.remove('auth-pending');
    return;
  }
  let navigating = false;
  try {
    await ensureSupabaseSdk();
    if (!globalThis.supabase?.createClient) throw new Error('SDK unavailable');
    const stopAuthTransport = onAuthTransport({
      report: event => console.info('[Sathivo Auth]', JSON.stringify(event)),
      onSendRateLimit: seconds => flow?.deferEmailRequests(seconds),
    });
    window.addEventListener('pagehide', stopAuthTransport, { once: true });
    const client = await getSathivoClient();
    appClient = client;
    const recoveryFetch = createAuthFetch({
      supabaseUrl: authConfig.supabaseUrl,
      report: event => console.info('[Sathivo Recovery]', JSON.stringify(event)),
      onSendRateLimit: seconds => flow?.deferEmailRequests(seconds),
    });
    const recoveryClient = globalThis.supabase.createClient(authConfig.supabaseUrl, authConfig.publishableKey, {
      global: { fetch: recoveryFetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sathivo.recovery.v1' },
    });
    flow = createAuthFlow({ auth: client.auth, recoveryAuth: recoveryClient.auth, enabled: true });
    client.auth.onAuthStateChange(event => {
      // Keep callbacks synchronous; SDK auth calls inside this callback can deadlock.
      if (event === 'SIGNED_OUT' && activePanel === 'account' && !busy) {
        showPanel('login');
        clearSecrets();
        document.querySelector('#account-email').textContent = '';
        document.querySelector('#account-name').textContent = 'friend';
        announce('Your session has ended. Please sign in again.', 'info');
      }
    });
    setBusy(true);
    const user = await flow.currentUser();
    if (user && emailBookingReturnRoute && !['forgot','verify-email'].includes(initialRoute)) {
      navigating = true;
      window.location.replace(new URL(emailBookingReturnRoute,window.location.href).href);
      return;
    }
    if (user && !['forgot', 'verify-email'].includes(initialRoute)) renderAccount(user);
  } catch {
    if (!flow) {
      notice.hidden = false;
      notice.textContent = 'Account services could not load. Please refresh the page or try again shortly.';
    } else announce('We could not restore your session. Please sign in again.', 'info');
  } finally {
    setBusy(false);
    if (!navigating) {
      // Reveal exactly one resolved screen; while checking, only the loader
      // is visible, never a misleading Login form for signed-in members.
      if (flow) notice.hidden = true;
      document.body.classList.remove('auth-pending');
    }
  }
}

const timer = setInterval(updateResend, 1000);
window.addEventListener('pagehide', () => {
  clearInterval(timer);
  clearSecrets();
  if (flow) void flow.cancelChallenge();
});
// A back/forward cache restore must not revive an old in-memory recovery grant.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
void initialize();
