import { setupPublishing } from './listing-publish.js?v=20261008-1';
import { authConfig } from './auth-config.js?v=20260926-1';
import { getSathivoClient } from './supabase-client.js?v=20261006-1';
import { avatarOptions, avatarMarker, avatarAsset, isBuiltinAvatar } from './avatar-utils.js?v=20261007-1';
import { compressImageFile,formatBytes } from './image-compress.js?v=20261006-1';
const $ = id => document.getElementById(id);
const form = $('profile-form');
const categories = ['Conversation','Coffee','Movies','Shopping','Events','Walking','Online chat','Phone conversation'];
let client, user, locations = [], avatarPath = null, savedAvatarPath = null, dirty = false;
function message(text, error=false) { $('profile-status').textContent=text; $('profile-status').dataset.error=String(error); }
function options(select, items, placeholder) {
  select.replaceChildren(new Option(placeholder,''));
  items.forEach(([value,label])=>select.add(new Option(label,String(value))));
}
const normalized=value=>String(value||'').trim().toLocaleLowerCase('en-IN');
let citySuggestionRequest=0;
function states(){options($('state'),[...new Set(locations.map(r=>r.state))].sort().map(v=>[v,v]),'Choose your state / UT');}
function districtRows(){return locations.filter(r=>r.state===$('state').value&&r.district===$('district').value);}
function districtLocationIds(){return districtRows().map(r=>r.id);}
function resolveLocationId(){
 const rows=districtRows(),name=$('city_name').value.trim();
 const exact=rows.find(r=>r.city!=='District-wide'&&normalized(r.city)===normalized(name));
 const fallback=rows.find(r=>r.city==='District-wide')||rows[0];
 const chosen=exact||fallback;
 $('location_id').value=chosen?String(chosen.id):'';
 return chosen;
}
function syncCityChoice(){
 const choice=$('city_choice').value,custom=choice==='__other__';
 $('custom-city-wrap').hidden=!custom;
 $('city_name').required=custom;
 if(!custom){
  $('city_name').value=choice||'';
  resolveLocationId();
 }
 updateCompleteness();
}
async function refreshCitySuggestions(preferred=''){
 const seq=++citySuggestionRequest,select=$('city_choice');
 if(!select)return;
 if(!$('state').value||!$('district').value){
  options(select,[],'Choose city / town');select.add(new Option('Other city / town — type manually','__other__'));
  $('custom-city-wrap').hidden=true;$('city_name').value='';$('location_id').value='';return;
 }
 const names=new Set(districtRows().filter(r=>r.city!=='District-wide').map(r=>r.city).filter(Boolean));
 try{
  if(client){
   const ids=districtLocationIds();
   const {data,error}=await client.rpc('browse_public_city_suggestions',{p_location_ids:ids.length?ids:null});
   if(!error)(data||[]).forEach(row=>{if(row.city_name)names.add(row.city_name);});
  }
 }catch{}
 if(seq!==citySuggestionRequest)return;
 const sorted=[...names].sort((a,b)=>a.localeCompare(b,'en-IN'));
 options(select,sorted.map(name=>[name,name]),'Choose city / town');
 select.add(new Option('Other city / town — type manually','__other__'));
 const exact=sorted.find(name=>normalized(name)===normalized(preferred));
 if(preferred){
  if(exact){select.value=exact;$('city_name').value=exact;$('custom-city-wrap').hidden=true;}
  else{select.value='__other__';$('city_name').value=preferred;$('custom-city-wrap').hidden=false;}
 }else{
  select.value='';$('city_name').value='';$('custom-city-wrap').hidden=true;
 }
 resolveLocationId();
}
function clearCity(){
 $('city_name').value='';$('location_id').value='';$('custom-city-wrap').hidden=true;
 void refreshCitySuggestions();
}
function districts(){
 options($('district'),[...new Set(locations.filter(r=>r.state===$('state').value).map(r=>r.district))].sort().map(v=>[v,v]),'Choose district');
 clearCity();
}
$('state').addEventListener('change',districts);
$('district').addEventListener('change',clearCity);
$('city_choice').addEventListener('change',syncCityChoice);
$('city_name').addEventListener('input',()=>{resolveLocationId();updateCompleteness();});
$('city_name').addEventListener('change',resolveLocationId);
categories.forEach(value=>{
  const label=document.createElement('label'), input=document.createElement('input');
  input.type='checkbox';input.name='categories';input.value=value;
  label.append(input,document.createTextNode(value));$('categories').append(label);
});
const avatarChoices=$('avatar-choices');
for(const group of [{title:'Male avatars',prefix:'male-'},{title:'Female avatars',prefix:'female-'}]){
  const section=document.createElement('section'),title=document.createElement('strong'),grid=document.createElement('div');
  section.className='avatar-group';title.className='avatar-group-title';title.textContent=group.title;grid.className='avatar-group-grid';
  avatarOptions.filter(item=>item.id.startsWith(group.prefix)).forEach(item=>{
    const button=document.createElement('button'), image=document.createElement('img');
    button.type='button';button.className='avatar-choice';button.dataset.avatar=item.id;button.setAttribute('aria-label','Use '+item.label);button.setAttribute('aria-pressed','false');
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
 $('save-profile').textContent=companion?'Save companion profile ↗':'Save & find companions ↗';
 $('profile-kind-hint').textContent=companion
  ? 'Your companion details stay private until you save and explicitly publish them.'
  : 'Your customer profile stays private. Only the details needed to use Sathivo are saved.';
 $('profile-mode-note-title').textContent=companion?'You’re setting up as a companion.':'Want to become a companion?';
 $('profile-mode-note-copy').textContent=companion
  ? 'Add your photo/avatar, bio, categories, availability and hourly rate, then save before publishing.'
  : 'Choose Become a companion or Both in the profile type whenever you want to create a public companion listing.';
 $('profile-mode-note-extra').textContent=companion
  ? 'Customers can send hourly offers. You choose what to accept; payment is settled directly between users outside Sathivo.'
  : 'As a customer, your saved profile is not published in Find a companion.';
 updateCompleteness();
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
 const pct=Math.round(values.filter(Boolean).length/values.length*100);
 $('profile-percent').textContent=pct+'%';$('profile-progress-bar').style.width=pct+'%';
 $('profile-progress-copy').textContent=pct===100
  ? (companion?'Profile complete — save it, then publish when ready.':'Customer profile complete — you’re ready to find companions.')
  : pct>=70?'Almost there. A few details will make your profile stronger.':'Add a few more details to finish your profile.';
}
function showSystemInfo(p){
 $('safety-id').textContent=p?.safety_id||'Assigned after first save';
 const verified=!!(user?.email_confirmed_at||p?.email_verified_at);
 $('email-trust').textContent=verified?'✓ Email verified':'Email verification pending';
 const joined=p?.joined_at||user?.created_at;
 $('joined-date').textContent=joined?'Member since '+new Intl.DateTimeFormat('en-IN',{month:'short',year:'numeric'}).format(new Date(joined)):'';
}
form.addEventListener('input',()=>{dirty=true;updateCompleteness();});
form.addEventListener('change',e=>{if(e.target.id==='profile_kind')syncModeUI();else updateCompleteness();});
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
  event.preventDefault();if(!user||!form.reportValidity())return;
  const values=new FormData(form);
  const row={user_id:user.id};
  row.display_name=String(values.get('display_name')||'').trim();
  row.profile_kind=String(values.get('profile_kind')||'customer').trim();
  row.gender=String(values.get('gender')||'').trim();
  row.languages=String(values.get('languages')||'').trim();
  row.interests=String(values.get('interests')||'').trim();
  const companion=['companion','both'].includes(row.profile_kind);
  row.bio=companion?String(values.get('bio')||'').trim():'';
  row.meeting_mode=companion?String(values.get('meeting_mode')||'online').trim():'online';
  row.availability=companion?String(values.get('availability')||'').trim():'';
  const rateRaw=String(values.get('hourly_rate')||'').trim();row.hourly_rate=companion?Number(rateRaw):null;
  if(['companion','both'].includes(row.profile_kind)&&(!Number.isInteger(row.hourly_rate)||row.hourly_rate<1||row.hourly_rate>100000)){message('Set a valid hourly companionship rate between ₹1 and ₹1,00,000.',true);$('hourly_rate').focus();return;}
  if(row.display_name.length<2||row.languages.length<2){message('Enter your name and languages (at least 2 characters).',true);return;}
  row.city_name=String(values.get('city_name')||'').trim();
  if(row.city_name.length<2||row.city_name.length>80){message('Enter your city or town (2–80 characters).',true);$('city_name').focus();return;}
  resolveLocationId();row.location_id=Number($('location_id').value);row.categories=companion?values.getAll('categories'):[];
  row.adult_confirmed=values.get('adult_confirmed')==='on';row.boundaries_accepted=values.get('boundaries_accepted')==='on';
  if(!locations.some(r=>r.id===row.location_id&&r.state===$('state').value&&r.district===$('district').value)){message('Choose your state and district again, then enter your city or town.',true);return;}
  $('fields').disabled=true;message('Saving your profile…');
  try {
    const fresh=await client.auth.getUser();if(fresh.error||fresh.data.user?.id!==user.id)throw Error('Your session ended. Sign in again before saving.');
    const file=companion?$('photo').files[0]:null;let preparedPhoto=null;
    if(file){preparedPhoto=await photoBlob(file);const path=user.id+'/avatar.webp';const upload=await client.storage.from('profile-photos').upload(path,preparedPhoto.blob,{upsert:true,contentType:preparedPhoto.type});if(upload.error)throw Error('Photo upload failed. Check your connection and try again.');avatarPath=path;}
    row.avatar_path=companion?avatarPath:null;
    const {data,error}=await client.from('member_profiles').upsert(row,{onConflict:'user_id'}).select('user_id,safety_id,joined_at,email_verified_at').single();
    if(error||!data)throw Error('Profile could not be saved. Check your connection and try again.');
    if(savedAvatarPath&&!isBuiltinAvatar(savedAvatarPath)&&savedAvatarPath!==avatarPath){
      try{await client.storage.from('profile-photos').remove([savedAvatarPath])}catch{}
    }
    savedAvatarPath=companion?avatarPath:null;dirty=false;$('photo').value='';if(localPreviewUrl){URL.revokeObjectURL(localPreviewUrl);localPreviewUrl=null;}showSystemInfo(data);
    if(preparedPhoto)message('Your profile is saved. Photo compressed '+formatBytes(preparedPhoto.originalBytes)+' → '+formatBytes(preparedPhoto.outputBytes)+'.');
    else message(companion?'Your companion profile is saved. Review it, then publish when you are ready.':'Your customer profile is saved. Taking you to Find a companion…');
    if(companion&&avatarPath)await showPhoto(avatarPath);else{$('avatar').hidden=true;syncAvatarChoice();}
    updateCompleteness();
    if(!companion){window.setTimeout(()=>location.assign('companions.html'),450);}
  }catch(error){message(error.message||'Could not save your profile. Please try again.',true);}
  finally{$('fields').disabled=false;$('profile-status').focus();}
});
async function init(){
  try{
    if(!authConfig.accountsEnabled)throw Error('Profile services could not load. Please refresh.');
    client=await getSathivoClient();
    const result=await client.auth.getUser();user=result.data?.user;
    if(!user){message('Sign in to create or edit your free profile.');$('signin').hidden=false;return;}
    const [loc,profile]=await Promise.all([client.from('profile_locations').select('*').order('state'),client.from('member_profiles').select('*').eq('user_id',user.id).maybeSingle()]);
    if(loc.error||profile.error)throw Error('Your profile could not load. Refresh to retry; your saved details are safe.');
    locations=loc.data;states();districts();
    const p=profile.data;
    if(p){
      for(const name of ['display_name','profile_kind','gender','bio','languages','interests','meeting_mode','availability'])$(name).value=p[name]||'';
      $('hourly_rate').value=p.hourly_rate||'';
      const loc=locations.find(r=>r.id===p.location_id);
      if(loc){
        $('state').value=loc.state;districts();$('district').value=loc.district;
        const savedCity=p.city_name||((loc.city&&loc.city!=='District-wide')?loc.city:'');
        await refreshCitySuggestions(savedCity);
        if(!$('location_id').value)$('location_id').value=String(loc.id);
      }
      form.querySelectorAll('[name=categories]').forEach(input=>input.checked=p.categories.includes(input.value));
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
    syncModeUI();
    $('fields').disabled=false;message(p?'Your saved profile. Make it feel like you.':'Let’s create your free profile.');
    if(isCompanionKind()&&avatarPath)await showPhoto(avatarPath);updateCompleteness();
    await setupPublishing({client,user,isDirty:()=>dirty});
    $('publication').hidden=!isCompanionKind();
    client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){dirty=false;location.replace('account.html');}});
  }catch(error){message(error.message||'Profile services are unavailable. Please refresh.',true);}
}
void init();
