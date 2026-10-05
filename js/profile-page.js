import { setupPublishing } from './listing-publish.js?v=20261006-2';
import { authConfig } from './auth-config.js?v=20260926-1';
import { getSathivoClient } from './supabase-client.js?v=20261006-1';
import { avatarOptions, avatarMarker, avatarAsset, isBuiltinAvatar } from './avatar-utils.js?v=20261006-1';
const $ = id => document.getElementById(id);
const form = $('profile-form');
const categories = ['Conversation','Coffee','Movies','Shopping','Events','Walking','Online chat','Phone conversation'];
let client, user, locations = [], avatarPath = null, savedAvatarPath = null, dirty = false;
function message(text, error=false) { $('profile-status').textContent=text; $('profile-status').dataset.error=String(error); }
function options(select, items, placeholder) {
  select.replaceChildren(new Option(placeholder,''));
  items.forEach(([value,label])=>select.add(new Option(label,String(value))));
}
function states() { options($('state'), [...new Set(locations.map(r=>r.state))].sort().map(v=>[v,v]),'Choose your state / UT'); }
function districts() { options($('district'), [...new Set(locations.filter(r=>r.state===$('state').value).map(r=>r.district))].sort().map(v=>[v,v]),'Choose district'); cities(); }
function cityLabel(row){return row.city==='District-wide'?`District-wide / my city isn't listed`:row.city;}
function cities() { options($('location_id'), locations.filter(r=>r.state===$('state').value&&r.district===$('district').value).map(r=>[r.id,cityLabel(r)]),'Choose city / town'); }
$('state').addEventListener('change',districts);
$('district').addEventListener('change',cities);
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
function syncRateField(){const companion=isCompanionKind();$('hourly-rate-field').hidden=!companion;$('hourly_rate').required=companion;if(!companion)$('hourly_rate').value='';updateCompleteness()}
function updateCompleteness(){
 const values=[
  $('display_name').value.trim().length>=2,
  $('gender').value!=='',
  $('bio').value.trim().length>=20,
  $('location_id').value!=='',
  $('languages').value.trim().length>=2,
  $('interests').value.trim().length>0,
  [...form.querySelectorAll('[name=categories]')].some(x=>x.checked),
  $('availability').value.trim().length>0,
  form.elements.adult_confirmed.checked,
  form.elements.boundaries_accepted.checked
 ];
 if(isCompanionKind())values.push(!!avatarPath||!!$('photo').files[0],Number($('hourly_rate').value)>=1);
 const pct=Math.round(values.filter(Boolean).length/values.length*100);
 $('profile-percent').textContent=pct+'%';$('profile-progress-bar').style.width=pct+'%';
 $('profile-progress-copy').textContent=pct===100?'Profile complete — ready to shine.':pct>=70?'Almost there. A few details will make your profile stronger.':'Add a few more details to help people understand your vibe.';
}
function showSystemInfo(p){
 $('safety-id').textContent=p?.safety_id||'Assigned after first save';
 $('email-trust').textContent=p?.email_verified_at?'✓ Email verified':'Email verification pending';
 $('joined-date').textContent=p?.joined_at?'Member since '+new Intl.DateTimeFormat('en-IN',{month:'short',year:'numeric'}).format(new Date(p.joined_at)):'';
}
form.addEventListener('input',()=>{dirty=true;updateCompleteness();});
form.addEventListener('change',e=>{if(e.target.id==='profile_kind')syncRateField();else updateCompleteness();});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
async function showPhoto(path) {
  const builtIn=avatarAsset(path);
  if(builtIn){$('avatar').src=builtIn;$('avatar').hidden=false;syncAvatarChoice();return;}
  const {data,error}=await client.storage.from('profile-photos').createSignedUrl(path,300);
  if(error) { message('Profile loaded, but the photo could not load. You can try again by refreshing.',true); return; }
  $('avatar').src=data.signedUrl;$('avatar').hidden=false;syncAvatarChoice();
}
async function photoBlob(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024) throw Error('Choose a JPG, PNG or WebP photo under 5 MB.');
  const bitmap=await createImageBitmap(file);
  if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error('Please choose a smaller photo.');}
  const scale=Math.min(1,800/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.85));
  if(!blob||blob.type!=='image/webp'||blob.size>2097152) throw Error('This photo could not be prepared. Try another photo.');
  return blob;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(!user||!form.reportValidity())return;
  const values=new FormData(form);
  const row={user_id:user.id};
  for(const name of ['display_name','profile_kind','gender','bio','languages','interests','meeting_mode','availability']) row[name]=String(values.get(name)||'').trim();
  const rateRaw=String(values.get('hourly_rate')||'').trim();row.hourly_rate=['companion','both'].includes(row.profile_kind)?Number(rateRaw):null;
  if(['companion','both'].includes(row.profile_kind)&&(!Number.isInteger(row.hourly_rate)||row.hourly_rate<1||row.hourly_rate>100000)){message('Set a valid hourly companionship rate between ₹1 and ₹1,00,000.',true);$('hourly_rate').focus();return;}
  if(row.display_name.length<2||row.languages.length<2){message('Enter your name and languages (at least 2 characters).',true);return;}
  row.location_id=Number(values.get('location_id'));row.categories=values.getAll('categories');
  row.adult_confirmed=values.get('adult_confirmed')==='on';row.boundaries_accepted=values.get('boundaries_accepted')==='on';
  if(!locations.some(r=>r.id===row.location_id&&r.state===$('state').value&&r.district===$('district').value)){message('Please select your location again.',true);return;}
  $('fields').disabled=true;message('Saving your profile…');
  try {
    const fresh=await client.auth.getUser();if(fresh.error||fresh.data.user?.id!==user.id)throw Error('Your session ended. Sign in again before saving.');
    const file=$('photo').files[0];
    if(file){const blob=await photoBlob(file);const path=user.id+'/avatar.webp';const upload=await client.storage.from('profile-photos').upload(path,blob,{upsert:true,contentType:'image/webp'});if(upload.error)throw Error('Photo upload failed. Check your connection and try again.');avatarPath=path;}
    row.avatar_path=avatarPath;
    const {data,error}=await client.from('member_profiles').upsert(row,{onConflict:'user_id'}).select('user_id,safety_id,joined_at,email_verified_at').single();
    if(error||!data)throw Error('Profile could not be saved. Check your connection and try again.');
    if(savedAvatarPath&&!isBuiltinAvatar(savedAvatarPath)&&savedAvatarPath!==avatarPath){
      try{await client.storage.from('profile-photos').remove([savedAvatarPath])}catch{}
    }
    savedAvatarPath=avatarPath;dirty=false;$('photo').value='';if(localPreviewUrl){URL.revokeObjectURL(localPreviewUrl);localPreviewUrl=null;}showSystemInfo(data);message('Your profile is saved. You can come back and edit it anytime.');
    if(avatarPath)await showPhoto(avatarPath);else{$('avatar').hidden=true;syncAvatarChoice();}updateCompleteness();
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
      if(loc){$('state').value=loc.state;districts();$('district').value=loc.district;cities();$('location_id').value=String(loc.id);}
      form.querySelectorAll('[name=categories]').forEach(input=>input.checked=p.categories.includes(input.value));
      form.elements.adult_confirmed.checked=p.adult_confirmed;form.elements.boundaries_accepted.checked=p.boundaries_accepted;
      avatarPath=p.avatar_path;savedAvatarPath=p.avatar_path;showSystemInfo(p);
    }else{$('display_name').value=user.user_metadata?.display_name||'';showSystemInfo(null);}
    syncRateField();
    $('fields').disabled=false;message(p?'Your saved profile. Make it feel like you.':'Let’s create your free profile.');
    if(avatarPath)await showPhoto(avatarPath);updateCompleteness();
    await setupPublishing({client,user,isDirty:()=>dirty});
    client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){dirty=false;location.replace('account.html');}});
  }catch(error){message(error.message||'Profile services are unavailable. Please refresh.',true);}
}
void init();
