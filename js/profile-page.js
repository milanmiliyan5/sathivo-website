import {createProfileScrollReset} from './profile-scroll.js?v=20261125-profile-scroll-1';
import {profileSectionCompletion,savedProfileTicks,nextProfileStage,stageAfterSave,availableProfileTabs,profileDraftChanged} from './profile-section-completion.js?v=20261125-persistent-ticks-1';
import {experienceCategoryGroups,experienceCategories,experienceLabel,experienceSafetyNote,experienceVisual} from './experience-categories.js?v=20261123-pastels-1';
import { setupPublishing,publicationProblem } from './listing-publish.js?v=20261126-safari-photo-1';
import {districtsByState,statesAndUTs} from './india-districts.js?v=20261015-1';
import { authConfig } from './auth-config.js?v=20260926-1';
import { getSathivoClient } from './supabase-client.js?v=20261025-polish-1';
import { avatarOptions, avatarMarker, avatarAsset, isBuiltinAvatar } from './avatar-utils.js?v=20261121-avatars-1';
import { compressImageFile } from './image-compress.js?v=20261126-safari-photo-1';
const $ = id => document.getElementById(id);
const form = $('profile-form');
const profileScroll=createProfileScrollReset(window,document);
const categories = experienceCategories;
const el=(tag,text,cssClass)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cssClass)element.className=cssClass;return element;};
let client, user, locations = [], avatarPath = null, savedAvatarPath = null, dirty = false, publishing = null;
let profileTab='personal',profileLoaded=false,hadSavedProfile=false;
let savedSectionProfile=null;
function markSafetySaved(p){
 for(const [name,prefix] of [['adult_confirmed','adult'],['boundaries_accepted','boundaries']]){
  const confirmed=p?.[name]===true&&form.elements[name].checked;
  $(prefix+'-confirmed-status').hidden=!confirmed;
  $(prefix+'-confirmation-control').hidden=confirmed;
 }
}
const profileTabs=new Set(['personal','companion','privacy']);
function showProfileTab(name,{record=false,focus=false,resetScroll=false}={}){
 profileScroll.cancel();
 const allowed=availableProfileTabs(savedSectionProfile,$('profile_kind').value);
 if(!allowed.includes(name))name=allowed[allowed.length-1];
 const changed=profileTab!==name;
 profileTab=name;
 document.querySelectorAll('[data-profile-tab]').forEach(button=>{
  const selected=button.dataset.profileTab===name;
  button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
 });
 document.querySelectorAll('[data-profile-panel]').forEach(panel=>{panel.hidden=panel.dataset.profilePanel!==name;});
 document.querySelectorAll('[data-profile-extra]').forEach(panel=>{panel.hidden=panel.dataset.profileExtra!==name;});
 // Profile tabs are views of one page, not navigation destinations.
 if(record&&changed)history.replaceState({...history.state,sathivoProfileTab:name},'',location.href);
 if(focus)$('profile-tab-'+name)?.focus({preventScroll:true});
 if(resetScroll)profileScroll.reset();
}
function revealProfileControl(control){
 profileScroll.cancel();
 const panel=control?.closest('[data-profile-panel]');
 if(panel)showProfileTab(panel.dataset.profilePanel,{record:true});
 if(control){
  for(let parent=control.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  control.focus();
 }
}
function validateProfileForm(section=profileTab){
 const panel=$('profile-panel-'+section);
 const invalid=[...form.elements].find(control=>panel.contains(control)&&control.willValidate&&!control.validity.valid);
 if(invalid){revealProfileControl(invalid);invalid.reportValidity();return false;}
 return true;
}
function syncSafetyPlacement(){
 const safety=$('profile-safety-section');
 const needsConfirmation=!savedSectionProfile?.adult_confirmed||!savedSectionProfile?.boundaries_accepted;
 const personal=!isCompanionKind()||(needsConfirmation&&(!form.elements.adult_confirmed.checked||!form.elements.boundaries_accepted.checked));
 const target=$('profile-panel-'+(personal?'personal':'privacy'));
 if(safety.parentElement!==target)target.prepend(safety);
 safety.hidden=!isCompanionKind()&&!needsConfirmation&&form.elements.adult_confirmed.checked&&form.elements.boundaries_accepted.checked;
}
function syncSummaryPhoto(){
 const source=$('avatar'),image=$('profile-summary-photo');
 if(!source||!image)return;
 const src=source.getAttribute('src');
 if(source.hidden||!src||!isCompanionKind()){image.hidden=true;image.removeAttribute('src');return;}
 if(image.getAttribute('src')!==src){image.hidden=true;image.src=src;}
 else if(image.complete&&image.naturalWidth)image.hidden=false;
}
$('profile-summary-photo').addEventListener('load',()=>{if(isCompanionKind()&&!$('avatar').hidden)$('profile-summary-photo').hidden=false;});
$('profile-summary-photo').addEventListener('error',()=>{$('profile-summary-photo').hidden=true;});
new MutationObserver(syncSummaryPhoto).observe($('avatar'),{attributes:true,attributeFilter:['src','hidden']});
document.querySelectorAll('[data-profile-tab]').forEach(button=>{
 button.addEventListener('click',()=>showProfileTab(button.dataset.profileTab,{record:true,resetScroll:true}));
 button.addEventListener('keydown',event=>{
  const tabs=availableProfileTabs(savedSectionProfile,$('profile_kind').value),index=tabs.indexOf(profileTab);
  const next=event.key==='ArrowRight'?tabs[(index+1)%tabs.length]:event.key==='ArrowLeft'?tabs[(index+tabs.length-1)%tabs.length]:event.key==='Home'?tabs[0]:event.key==='End'?tabs[tabs.length-1]:null;
  if(next){event.preventDefault();showProfileTab(next,{record:true,focus:true,resetScroll:true});}
 });
});
$('profile-choose-companion').addEventListener('click',()=>revealProfileControl($('profile_kind')));
// Older releases created same-document history entries for each tab.
// If Back reaches one of those entries, leave the editor rather than reopening a tab.
window.addEventListener('popstate',event=>{
 if(!profileTabs.has(event.state?.sathivoProfileTab))return;
 profileScroll.cancel();
 location.replace('account.html#account');
});
// Preserve the current view on refresh without adding browser Back entries.
if('scrollRestoration' in history)history.scrollRestoration='manual';
const initialProfileTab=profileTabs.has(history.state?.sathivoProfileTab)?history.state.sathivoProfileTab:(location.hash==='#your-kind-of-company'?'companion':'personal');
history.replaceState({...history.state,sathivoProfileTab:initialProfileTab},'',location.href);
showProfileTab(initialProfileTab);
function message(text, error=false) { $('profile-status').textContent=text; $('profile-status').dataset.error=String(error); }
function options(select, items, placeholder) {
  select.replaceChildren(new Option(placeholder,''));
  items.forEach(([value,label])=>select.add(new Option(label,String(value))));
}
const normalized=value=>String(value||'').trim().toLocaleLowerCase('en-IN');
function states(){options($('state'),statesAndUTs.map(name=>[name,name]),'Choose your state / UT');}
function districtRows(){return locations.filter(r=>r.state===$('state').value&&r.district===$('district').value);}
function resolveLocationId(){
 const rows=districtRows(),name=$('city_name').value.trim();
 const exact=rows.find(r=>r.city!=='District-wide'&&normalized(r.city)===normalized(name));
 const chosen=exact||rows.find(r=>r.city==='District-wide')||rows[0];
 $('location_id').value=chosen?String(chosen.id):'';
 return chosen;
}
function clearCity(){
 $('city_name').value='';resolveLocationId();updateCompleteness();
}
function districts(){
 options($('district'),(districtsByState[$('state').value]||[]).map(v=>[v,v]),'Choose district');
 clearCity();
}
$('state').addEventListener('change',()=>{districts();dirty=true;});
$('district').addEventListener('change',()=>{clearCity();dirty=true;});
$('city_name').addEventListener('input',()=>{resolveLocationId();updateCompleteness();});
$('city_name').addEventListener('change',resolveLocationId);
// Five compact groups keep 21 choices usable on both desktop and phones.
function updateCategoryGroupCounts(){
 for(const section of $('categories').querySelectorAll('.category-group')){
  const count=section.querySelectorAll('input[name="categories"]:checked').length;
  const countLabel=section.querySelector('.category-count');
  countLabel.textContent=count?count+' selected':'Choose';
  if(count)section.open=true;
 }
}
for(const [index,group] of experienceCategoryGroups.entries()){
 const section=document.createElement('details');section.className='category-group';section.open=index===0;
 const summary=document.createElement('summary');
 const heading=el('strong',group.title),count=el('span','Choose','category-count');
 summary.append(heading,count);section.append(summary);
 const choices=el('div',undefined,'category-group-choices');
 for(const value of group.items){
  const label=document.createElement('label'),input=document.createElement('input');
  input.type='checkbox';input.name='categories';input.value=value;
  const visual=experienceVisual(value);
  label.dataset.activityTone=visual.tone;
  const icon=el('i',visual.icon,'category-choice-icon');
  icon.setAttribute('aria-hidden','true');
  label.append(input,icon,document.createTextNode(experienceLabel(value)));
  label.title=experienceSafetyNote(value);
  choices.append(label);
 }
 section.append(choices);
 if(group.title==='Everyday Help & Companionship'){
  section.append(el('p','Hospital visits and senior companionship are scheduled social assistance only—not emergency response, nursing, personal care or medical treatment.','category-safety-note'));
 }
 if(group.title==='Education & Career'){
  section.append(el('p','Study and college-project help means guidance and practice, not doing someone else’s assessed work.','category-safety-note'));
 }
 $('categories').append(section);
}
$('categories').addEventListener('change',updateCategoryGroupCounts);
const avatarChoices=$('avatar-choices');
for(const group of [{title:'Male avatars',prefix:'male-'},{title:'Female avatars',prefix:'female-'}]){
  const section=document.createElement('section'),title=document.createElement('strong'),grid=document.createElement('div');
  section.className='avatar-group';title.className='avatar-group-title';title.textContent=group.title;grid.className='avatar-group-grid';
  avatarOptions.filter(item=>item.id.startsWith(group.prefix)).forEach(item=>{
    const button=document.createElement('button'), image=document.createElement('img');
    button.type='button';button.className='avatar-choice';button.dataset.avatar=item.id;button.setAttribute('aria-label','Use '+item.label);button.title=item.label;button.setAttribute('aria-pressed','false');
    image.src=item.src;image.alt='';image.loading='lazy';button.append(image);grid.append(button);
  });
  section.append(title,grid);avatarChoices.append(section);
}
function syncAvatarChoice(){
  const current=isBuiltinAvatar(avatarPath)?avatarPath.slice(8):'';
  const hasFile=!!$('photo').files[0];
  avatarChoices.querySelectorAll('.avatar-choice').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.avatar===current&&!hasFile)));
  $('clear-avatar').hidden=!(avatarPath||hasFile);
}
avatarChoices.addEventListener('click',event=>{
  const button=event.target.closest('.avatar-choice');if(!button)return;
  avatarPath=avatarMarker(button.dataset.avatar);$('photo').value='';dirty=true;syncAvatarChoice();void showPhoto(avatarPath);updateCompleteness();
  message('Avatar selected. Save your profile to keep it.');
});
$('clear-avatar').addEventListener('click',()=>{
  if(localPreviewUrl){URL.revokeObjectURL(localPreviewUrl);localPreviewUrl=null;}
  $('photo').value='';avatarPath=null;$('avatar').removeAttribute('src');$('avatar').hidden=true;dirty=true;syncAvatarChoice();updateCompleteness();
  message('Photo/avatar removed. Save your profile to keep this change.');
});
let localPreviewUrl=null;
$('photo').addEventListener('change',()=>{
  const file=$('photo').files[0];
  if(!file){syncAvatarChoice();updateCompleteness();return;}
  if(localPreviewUrl)URL.revokeObjectURL(localPreviewUrl);
  localPreviewUrl=URL.createObjectURL(file);$('avatar').src=localPreviewUrl;$('avatar').hidden=false;syncAvatarChoice();updateCompleteness();
});
function isCompanionKind(){return ['companion','both'].includes($('profile_kind').value)}
function setSectionDisabled(id,disabled){
 const section=$(id);if(!section)return;
 section.hidden=disabled;
 section.querySelectorAll('input,select,textarea,button').forEach(control=>{control.disabled=disabled;});
}
function syncModeUI(){
 const companion=isCompanionKind();
 document.body.dataset.profileMode=companion?'companion':'customer';
 setSectionDisabled('companion-photo-section',!companion);
 setSectionDisabled('companion-bio-section',!companion);
 setSectionDisabled('companion-details-section',!companion);
 $('hourly_rate').required=companion;
 $('publication').hidden=!companion;
 $('save-profile').textContent='Save';
 for(const name of ['companion','privacy'])$('profile-tab-'+name).hidden=!companion;
 if(!companion&&profileTab!=='personal')showProfileTab('personal');
 syncSafetyPlacement();
 $('profile-customer-companion-note').hidden=companion;
 syncSummaryPhoto();
 $('profile-kind-hint').textContent=companion?'Manage public visibility in Privacy.':'Your customer profile stays private.';
 publishing?.syncMode();
 updateCompleteness();
}
function currentDraft(){
 return {
  profile_kind:$('profile_kind').value,display_name:$('display_name').value,gender:$('gender').value,
  location_id:$('location_id').value,city_name:$('city_name').value,languages:$('languages').value,interests:$('interests').value,
  avatar_path:avatarPath,bio:$('bio').value,meeting_mode:$('meeting_mode').value,availability:$('availability').value,hourly_rate:$('hourly_rate').value,
  categories:[...form.querySelectorAll('[name=categories]:checked')].map(input=>input.value),
  adult_confirmed:form.elements.adult_confirmed.checked,boundaries_accepted:form.elements.boundaries_accepted.checked
 };
}
function currentCompletion(){return profileSectionCompletion(savedSectionProfile,currentDraft(),{pendingPhoto:!!$('photo').files[0]});}
function updateSectionTicks(){
 const completed=savedProfileTicks(savedSectionProfile,{hasListing:publishing?.hasListing()===true});
 const allowed=availableProfileTabs(savedSectionProfile,$('profile_kind').value);
 document.querySelectorAll('[data-profile-tab]').forEach(button=>{
  button.disabled=!allowed.includes(button.dataset.profileTab);
  const done=completed[button.dataset.profileTab]===true;
  button.querySelector('.profile-section-tick').toggleAttribute('hidden',!done);
  const label=button.querySelector('span').textContent;
  button.setAttribute('aria-label',label+(done?', completed':''));
 });
}
function updateCompleteness(){
 const companion=isCompanionKind();
 const values=[
  $('display_name').value.trim().length>=2,
  $('gender').value!=='',
  $('city_name').value.trim().length>=2&&$('location_id').value!=='',
  $('languages').value.trim().length>=2,
  $('interests').value.trim().length>0,
  form.elements.adult_confirmed.checked,
  form.elements.boundaries_accepted.checked
 ];
 if(companion)values.push(
  $('bio').value.trim().length>=20,
  [...form.querySelectorAll('[name=categories]')].some(x=>x.checked),
  $('availability').value.trim().length>0,
  !!avatarPath||!!$('photo').files[0],
  Number($('hourly_rate').value)>=1
 );
 const name=$('display_name').value.trim()||'Your profile';
 $('profile-summary-name').textContent=name;
 $('profile-summary-initial').textContent=name.slice(0,1).toUpperCase()||'S';
 const pct=Math.round(values.filter(Boolean).length/values.length*100);
 $('profile-percent').textContent=pct+'%';$('profile-progress-bar').style.width=pct+'%';
 $('profile-progress-copy').textContent=pct===100?'':'Complete the remaining profile details.';
 updateSectionTicks();
}
function showSystemInfo(p){
 $('safety-id').textContent=p?.safety_id||'Assigned after first save';
 const verified=!!(user?.email_confirmed_at||p?.email_verified_at);
 $('email-trust').textContent=verified?'✓ Email verified':'Email verification pending';
 $('email-trust').dataset.verified=String(verified);
 const joined=p?.joined_at||user?.created_at;
 $('joined-date').textContent=joined?'Member since '+new Intl.DateTimeFormat('en-IN',{month:'short',year:'numeric'}).format(new Date(joined)):'';
}
form.addEventListener('input',()=>{dirty=true;updateCompleteness();});
form.addEventListener('change',e=>{if(e.target.id==='profile_kind')syncModeUI();else{if(e.target.id==='gender')publishing?.syncMode();updateCompleteness();}});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
async function showPhoto(path) {
  const builtIn=avatarAsset(path);
  if(builtIn){$('avatar').src=builtIn;$('avatar').hidden=false;syncAvatarChoice();return;}
  const {data,error}=await client.storage.from('profile-photos').createSignedUrl(path,300);
  if(error) { message('Profile loaded, but the photo could not load. You can try again by refreshing.',true); return; }
  $('avatar').src=data.signedUrl;$('avatar').hidden=false;syncAvatarChoice();
}
async function photoBlob(file) {
  return compressImageFile(file,{maxBytes:300*1024,maxDimension:900,minDimension:480,maxInputBytes:50*1024*1024});
}

form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!user||!profileLoaded||$('fields').disabled)return;
 const section=profileTab,companion=isCompanionKind(),draft=currentDraft(),kind=draft.profile_kind;
 if(!validateProfileForm(section))return;
 if(!publishing?.isKnown()){message('Could not check profile visibility. Refresh before saving.',true);return;}
 const done=currentCompletion();
 const fail=(text,tab,control)=>{showProfileTab(tab,{record:true});message(text,true);if(control)revealProfileControl(control);else $('profile-status').focus();};
 if(section!=='personal'&&!done.personal){fail('Save your Personal details first.','personal');return;}
 if(section==='privacy'&&!done.companion){fail('Save your Companion details first.','companion');return;}
 if(section==='personal'){
  if(draft.display_name.trim().length<2||draft.languages.trim().length<2){fail('Enter your name and languages (at least 2 characters).','personal');return;}
  resolveLocationId();draft.location_id=Number($('location_id').value);
  if(draft.city_name.trim().length<2||draft.city_name.trim().length>80||!locations.some(r=>r.id===draft.location_id&&r.state===$('state').value&&r.district===$('district').value)){fail('Choose your state and district and enter your city or town.','personal',$('city_name'));return;}
  if(companion&&(!avatarPath&&!$('photo').files[0]||draft.bio.trim().length<20)){fail('Add a photo or avatar and a bio of at least 20 characters.','personal');return;}
  if(!draft.adult_confirmed||!draft.boundaries_accepted){syncSafetyPlacement();fail('Confirm the 18+ declaration and platonic agreement.','personal');return;}
 }
 if(section==='companion'){
  if(!draft.categories.length){fail('Choose at least one activity.','companion');return;}
  const rate=Number(draft.hourly_rate);
  if(!Number.isInteger(rate)||rate<1||rate>100000){fail('Set a valid hourly rate between ₹1 and ₹1,00,000.','companion',$('hourly_rate'));return;}
 }
 if(section==='privacy'&&(!draft.adult_confirmed||!draft.boundaries_accepted)){fail('Confirm both safety declarations.','privacy');return;}
 const wasNew=!hadSavedProfile;
 $('fields').disabled=true;publishing.setBusy(true);message('Saving…');
 let privateSaved=false,advance=false;
 try{
  const fresh=await client.auth.getUser();if(fresh.error||fresh.data.user?.id!==user.id)throw Error('Your session ended. Sign in again before saving.');
  // Personal and Companion save only private data. Only Privacy applies new publication choices.
  const final=section==='privacy'||!companion;
  const file=section==='personal'&&companion?$('photo').files[0]:null;
  let preparedPhoto=null;
  await publishing.prepareSave({applyVisibility:final,photoChanged:section==='privacy'&&['companion','privacy'].includes(savedSectionProfile?.setup_stage)});
  let row;
  if(section==='personal'){
   if(file){preparedPhoto=await photoBlob(file);const path=user.id+'/avatar.webp';const upload=await client.storage.from('profile-photos').upload(path,preparedPhoto.blob,{upsert:true,contentType:preparedPhoto.type});if(upload.error){console.warn('Profile photo upload failed:',upload.error.statusCode||upload.error.name);throw Error('Photo upload failed. Please try a different photo or refresh and try again.');}avatarPath=path;}
   row={user_id:user.id,profile_kind:kind,display_name:draft.display_name.trim(),gender:draft.gender,location_id:draft.location_id,city_name:draft.city_name.trim(),languages:draft.languages.trim(),interests:draft.interests.trim(),bio:companion?draft.bio.trim():'',avatar_path:companion?avatarPath:null,adult_confirmed:draft.adult_confirmed,boundaries_accepted:draft.boundaries_accepted,setup_stage:stageAfterSave(section,kind,{saved:savedSectionProfile,hasListing:publishing.hasListing()})};
   if(!companion||!savedSectionProfile||savedSectionProfile.profile_kind==='customer')Object.assign(row,{categories:[],meeting_mode:'online',availability:'',hourly_rate:null});
  }else if(section==='companion'){
   row={categories:draft.categories,meeting_mode:draft.meeting_mode,availability:draft.availability.trim(),hourly_rate:Number(draft.hourly_rate),setup_stage:stageAfterSave(section,kind,{saved:savedSectionProfile,hasListing:publishing.hasListing()})};
  }else{
   row={adult_confirmed:draft.adult_confirmed,boundaries_accepted:draft.boundaries_accepted};
  }
  const result=section==='personal'&&!savedSectionProfile
   ?await client.from('member_profiles').upsert(row,{onConflict:'user_id'}).select('*').single()
   :await client.from('member_profiles').update(row).eq('user_id',user.id).select('*').single();
  const {data,error}=result;
  if(error||!data)throw Error('Profile could not be saved. Check your connection and try again.');
  savedSectionProfile={...data};privateSaved=true;hadSavedProfile=true;
  if(section==='personal'){
   if(savedAvatarPath&&!isBuiltinAvatar(savedAvatarPath)&&savedAvatarPath!==data.avatar_path){
    try{await client.storage.from('profile-photos').remove([savedAvatarPath])}catch{}
   }
   savedAvatarPath=data.avatar_path;avatarPath=data.avatar_path;$('photo').value='';
   if(localPreviewUrl){URL.revokeObjectURL(localPreviewUrl);localPreviewUrl=null;}
   if(companion&&avatarPath)await showPhoto(avatarPath);else{$('avatar').hidden=true;syncAvatarChoice();}
  }
  markSafetySaved(data);syncSafetyPlacement();showSystemInfo(data);updateCompleteness();
  if(final){
   if(companion){
    const confirmed=profileSectionCompletion(data,currentDraft());
    if(!confirmed.personal||!confirmed.companion)throw Error('Profile details changed in another session. Reload and review your details before publishing.');
   }
   const visibility=await publishing.saveVisibility(data,{photoChanged:section==='privacy'&&['companion','privacy'].includes(data.setup_stage),uploadedBlob:preparedPhoto?.blob||null});
   if(section==='privacy'){
    const finish=await client.from('member_profiles').update({setup_stage:'complete'}).eq('user_id',user.id).select('*').single();
    if(finish.error||!finish.data)throw Error('Visibility saved, but setup completion could not be recorded. Save again to retry.');
    savedSectionProfile=finish.data;
   }
   message(visibility.published?(visibility.active?'Profile saved and published.':'Profile saved. Public listing is subject to moderation.'):'Profile saved and kept private.');
   if(!companion&&wasNew)window.setTimeout(()=>location.assign('companions.html'),450);
  }else{
   message('');
   advance=true;
  }
  dirty=profileDraftChanged(savedSectionProfile,currentDraft(),{pendingPhoto:!!$('photo').files[0]})||publishing.hasPendingChanges();
  updateCompleteness();
 }catch(error){
  await publishing.recover();
  if(error.message?.includes('Visibility changed in another session'))showProfileTab('privacy',{record:true});
  message((privateSaved?'Saved details. ':'')+(error.message||'Could not save. Please try again.'),true);updateCompleteness();
 }finally{
  $('fields').disabled=false;publishing.setBusy(false);
  if(advance)showProfileTab(section==='personal'?'companion':'privacy',{record:true,focus:true,resetScroll:true});
  else if($('profile-status').textContent)$('profile-status').focus();
 }
});
async function init(){
  try{
    if(!authConfig.accountsEnabled)throw Error('Profile services could not load. Please refresh.');
    client=await getSathivoClient();
    const result=await client.auth.getUser();user=result.data?.user;
    if(!user){message('Sign in to create or edit your free profile.');$('signin').hidden=false;return;}
    const [loc,profile,activeBadge]=await Promise.all([client.from('profile_locations').select('*').order('state'),client.from('member_profiles').select('*').eq('user_id',user.id).maybeSingle(),client.from('active_member_badges').select('user_id').eq('user_id',user.id).maybeSingle()]);
    if(loc.error||profile.error)throw Error('Your profile could not load. Refresh to retry; your saved details are safe.');
    // A public community-activity badge is independent from account email verification.
    $('active-member-own-badge').hidden=!!activeBadge.error||!activeBadge.data;
    locations=loc.data;states();districts();
    const p=profile.data;
    hadSavedProfile=!!p;
    savedSectionProfile=p?{...p}:null;
    if(p){
      for(const name of ['display_name','profile_kind','gender','bio','languages','interests','meeting_mode','availability'])$(name).value=p[name]||'';
      $('hourly_rate').value=p.hourly_rate||'';
      const loc=locations.find(r=>r.id===p.location_id);
      if(loc){
        $('state').value=loc.state;districts();$('district').value=loc.district;
        const savedCity=p.city_name||((loc.city&&loc.city!=='District-wide')?loc.city:'');
        savedSectionProfile.city_name=savedCity;
        $('city_name').value=savedCity;
        resolveLocationId();
        if(!$('location_id').value)$('location_id').value=String(loc.id);
        savedSectionProfile.location_id=$('location_id').value;
      }
      form.querySelectorAll('[name=categories]').forEach(input=>input.checked=p.categories.includes(input.value));updateCategoryGroupCounts();
      form.elements.adult_confirmed.checked=p.adult_confirmed;form.elements.boundaries_accepted.checked=p.boundaries_accepted;
      avatarPath=p.avatar_path;savedAvatarPath=p.avatar_path;showSystemInfo(p);
    }else{
      $('display_name').value=user.user_metadata?.display_name||'';
      const signupGender=String(user.user_metadata?.gender||'');
      if(['male','female','other','prefer_not_to_say'].includes(signupGender))$('gender').value=signupGender;
      form.elements.adult_confirmed.checked=!!user.user_metadata?.adult_declaration;
      form.elements.boundaries_accepted.checked=!!user.user_metadata?.community_rules_version;
      showSystemInfo(null);
    }
    syncModeUI();markSafetySaved(p);syncSafetyPlacement();
    publishing=await setupPublishing({client,user,isCompanion:isCompanionKind,canShowGender:()=>['male','female','other'].includes($('gender').value),onDraftChange:()=>{dirty=true;updateSectionTicks();}});
    const resume=nextProfileStage(savedSectionProfile,{hasListing:publishing.hasListing()});
    if(!p||resume!=='personal'||!isCompanionKind())showProfileTab(resume,{record:false,resetScroll:true});
    else showProfileTab(initialProfileTab,{record:false});
    message(p?'':'Complete your profile to get started.');
    // The 21-activity announcement deep-links here, after saved selections
    // are restored. Do not alter selections or force profile publishing.
    if(location.hash==='#your-kind-of-company'&&profileTab==='companion'&&isCompanionKind()){
      profileScroll.cancel();
      requestAnimationFrame(()=>{
        const heading=$('your-kind-of-company');
        heading?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
        heading?.focus({preventScroll:true});
      });
    }
    if(isCompanionKind()&&avatarPath)await showPhoto(avatarPath);updateCompleteness();
    publishing.syncMode();updateSectionTicks();
    $('fields').disabled=false;profileLoaded=true;
    $('publication').hidden=!isCompanionKind();
    client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){dirty=false;location.replace('account.html');}});
  }catch(error){message(error.message||'Profile services are unavailable. Please refresh.',true);}
}
void init();
