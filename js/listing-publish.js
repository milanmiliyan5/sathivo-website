import { isBuiltinAvatar } from './avatar-utils.js?v=20261121-avatars-1';
// Public identity is opted-in separately from private profile data.
// Once a member has published, keep their card avatar in sync without
// exposing unrelated draft edits or publishing a hidden listing.
export async function syncPublishedCardPhoto(client,userId,avatarPath,photoChanged=false,uploadedBlob=null) {
 const {data:listing,error:readError}=await client.from('companion_listings')
  .select('published,photo_path').eq('user_id',userId).maybeSingle();
 if(readError)throw Error('Could not check the public companion card.');
 if(!listing?.published)return {published:false,updated:false,hidden:false};
 if(!avatarPath){
  const {error}=await client.from('companion_listings').update({published:false})
   .eq('user_id',userId).eq('published',true);
  if(error)throw Error('Could not hide the public listing after removing its photo.');
  return {published:false,updated:false,hidden:true};
 }
 if(!photoChanged)return {published:true,updated:false,hidden:false};
 let publicPath=avatarPath;
 if(!isBuiltinAvatar(avatarPath)){
  let blob=uploadedBlob;
  if(!blob){
   const download=await client.storage.from('profile-photos').download(avatarPath);
   if(download.error||!download.data)throw Error('Could not read the saved profile photo.');
   blob=download.data;
  }
  publicPath=userId+'/avatar.webp';
  const upload=await client.storage.from('listing-photos').upload(publicPath,blob,
   {upsert:true,contentType:'image/webp',cacheControl:'0',cacheControl:'0'});
  if(upload.error)throw Error('Could not update the public companion photo.');
 }
 const {error:updateError}=await client.from('companion_listings').update({photo_path:publicPath})
  .eq('user_id',userId).eq('published',true);
 if(updateError)throw Error('Could not link the new photo to the public companion card.');
 if(isBuiltinAvatar(avatarPath)&&listing.photo_path===userId+'/avatar.webp'){
  // The replaced public upload is no longer needed. Ignore cleanup errors.
  try{await client.storage.from('listing-photos').remove([userId+'/avatar.webp']);}catch{}
 }
 return {published:true,updated:true,hidden:false};
}

export async function setupPublishing({client,user,isDirty,onRequestPublish}) {
 const $=id=>document.getElementById(id);
 const status=$('listing-status'), publish=$('publish-listing'), gender=$('public-gender-consent'), view=$('view-listing'), update=$('update-public-listing');
 let busy=false,known=false,listingPublished=false,listingGender=false;
 function render(){
  publish.setAttribute('aria-checked',String(known&&listingPublished));
  gender.setAttribute('aria-checked',String(known&&listingPublished&&listingGender));
  publish.disabled=busy||!known;gender.disabled=busy||!known||!listingPublished;
  view.hidden=update.hidden=!(known&&listingPublished);update.disabled=busy;
  $('publish-listing-description').textContent=!known?'Visibility unavailable':listingPublished?'Visible in Explore':'Hidden from Explore';
  $('public-gender-consent-description').textContent=!known?'Status unavailable':!listingPublished?'Choose when publishing':listingGender?'Visible on public profile':'Private';
  publish.dataset.known=gender.dataset.known=String(known);
 }
 async function refresh(){
  const {data,error}=await client.from('companion_listings').select('public_id,published,public_gender').eq('user_id',user.id).maybeSingle();
  if(error)throw Error('Could not check listing status. Refresh to retry.');
  listingPublished=!!data?.published;listingGender=['male','female','other'].includes(data?.public_gender);
  known=true;
  if(data?.published)view.href='companion.html?id='+encodeURIComponent(data.public_id);else view.removeAttribute('href');
  render();
 }
 async function refreshStatus(){
  try{await refresh();status.textContent='';return true;}
  catch(error){known=false;render();status.textContent=error.message;return false;}
 }
 async function run(task){
  if(busy||!known||$('fields').disabled)return false;
  busy=true;$('fields').disabled=true;render();status.textContent='Updating…';
  try{
   const auth=await client.auth.getUser();
   if(auth.error||auth.data.user?.id!==user.id)throw Error('Sign in again before changing visibility.');
   await task();await refresh();status.textContent='';return true;
  }catch(error){
   const failure=error.message||'Could not update your listing. Try again.';
   try{await refresh();}catch{known=false;}
   status.textContent=failure+(known?'':' Visibility could not be verified. Refresh to retry.');
   return false;
  }finally{busy=false;$('fields').disabled=false;render();if(!$('publish-prompt')?.open&&status.textContent)status.focus();}
 }
 async function publishSavedProfile({confirmedInPrompt=false,showGender=false}={}){return run(async()=>{
  if(isDirty())throw Error('Save your profile changes first, then publish.');
  if(!confirmedInPrompt||!$('publish-consent').checked)throw Error('Confirm that your saved profile details and photo/avatar can be public.');
  status.textContent='Publishing your saved profile…';
  const {data:p,error}=await client.from('member_profiles').select('*').eq('user_id',user.id).single();
  if(error||!p)throw Error('Save your profile first.');
  if(!['companion','both'].includes(p.profile_kind))throw Error('Choose Become a companion or Both, then save.');
  if(!p.adult_confirmed||!p.boundaries_accepted)throw Error('Confirm and save your safety declarations before publishing.');
  if(p.bio.trim().length<20||!p.categories.length)throw Error('Save a bio of at least 20 characters and select at least one category.');
  if(!Number.isInteger(p.hourly_rate)||p.hourly_rate<1||p.hourly_rate>100000)throw Error('Set and save your hourly companionship rate before publishing.');
  if(!p.avatar_path)throw Error('Add a profile photo or choose a Sathivo avatar before publishing.');
  const row={user_id:user.id,published:true,photo_path:null,public_gender:showGender&&['male','female','other'].includes(p.gender)?p.gender:null};
  for(const k of ['display_name','bio','location_id','city_name','languages','interests','categories','meeting_mode','availability','hourly_rate'])row[k]=p[k];
  // Hide before replacing the public photo so a failed update cannot expose a new photo on an old listing.
  const hidden=await client.from('companion_listings').update({published:false}).eq('user_id',user.id);
  if(hidden.error)throw Error('Could not prepare publication. Try again.');
  // Busy controls stay disabled until the final database read confirms visibility.
  if(isBuiltinAvatar(p.avatar_path)){
   row.photo_path=p.avatar_path;
   // A previous uploaded public photo is no longer referenced; remove it when possible.
   try{await client.storage.from('listing-photos').remove([user.id+'/avatar.webp'])}catch{}
  }else{
   const image=await client.storage.from('profile-photos').download(p.avatar_path);
   if(image.error)throw Error('Listing is hidden. Could not prepare your photo; try publishing again.');
   const path=user.id+'/avatar.webp';
   const upload=await client.storage.from('listing-photos').upload(path,image.data,{upsert:true,contentType:'image/webp'});
   if(upload.error)throw Error('Listing is hidden. Photo upload failed; try publishing again.');
   row.photo_path=path;
  }
  const saved=await client.from('companion_listings').upsert(row,{onConflict:'user_id'}).select('public_id').single();
  if(saved.error)throw Error('Listing remains hidden. Could not publish; try again.');
  // Remember an explicit publication choice so the one-time question is not repeated.
  if(['male','female','other'].includes(p.gender)){
   try{await client.from('companion_gender_prompt_responses').upsert(
    {user_id:user.id,show_gender:!!showGender},
    {onConflict:'user_id',ignoreDuplicates:true}
   );}catch{}
  }
  $('publish-consent').checked=false;
  // In-app nearby notices are committed by the DB. Push is opt-in and idempotent.
  // Never block an otherwise successful publication if browser push fails.
  if(saved.data?.public_id){
   void client.functions.invoke('send-nearby-push',{body:{public_id:saved.data.public_id}})
    .catch(()=>{ /* Nearby browser push is optional. */ });
  }
 });}
 publish.addEventListener('click',()=>{
  if(busy||!known||$('fields').disabled)return;
  if(!listingPublished){onRequestPublish();return;}
  void run(async()=>{
   const {error}=await client.from('companion_listings').update({published:false}).eq('user_id',user.id).select('public_id').single();
   if(error)throw Error('Could not hide your listing. Try again.');
  });
 });
 gender.addEventListener('click',()=>{
  if(busy||!known||!listingPublished||$('fields').disabled)return;
  const show=!listingGender;
  void run(async()=>{
   let publicGender=null;
   if(show){
    if(isDirty())throw Error('Save your profile before showing your gender.');
    const {data:p,error}=await client.from('member_profiles').select('gender').eq('user_id',user.id).single();
    if(error||!['male','female','other'].includes(p?.gender))throw Error('Choose and save a gender in Personal before showing it.');
    publicGender=p.gender;
   }
   const {error}=await client.from('companion_listings').update({public_gender:publicGender}).eq('user_id',user.id).eq('published',true).select('public_id').single();
   if(error)throw Error('Could not update gender visibility. Try again.');
   try{await client.from('companion_gender_prompt_responses').upsert({user_id:user.id,show_gender:show},{onConflict:'user_id',ignoreDuplicates:true});}catch{}
  });
 });
 await refreshStatus();
 return {publishSavedProfile,refreshStatus,isPublished:()=>known&&listingPublished,isKnown:()=>known,showGender:()=>known&&listingPublished&&listingGender};
}
