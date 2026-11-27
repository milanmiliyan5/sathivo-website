import { encodedPhotoType } from './image-compress.js?v=20261126-safari-photo-1';
import { isBuiltinAvatar } from './avatar-utils.js?v=20261121-avatars-1';

// Visibility switches edit a local draft. Only final Privacy Save can enable publication.
export function visibilityDraft(listing){
 const published=listing?.published===true;
 return {published,showGender:published&&['male','female','other'].includes(listing?.public_gender)};
}
export function nextVisibility(draft,action,canShowGender=true){
 if(action==='public')return {published:!draft.published,showGender:false};
 if(action==='gender'&&draft.published&&canShowGender)return {...draft,showGender:!draft.showGender};
 if(action==='private')return {published:false,showGender:false};
 if(action==='no-gender')return {...draft,showGender:false};
 return {...draft};
}
export function publicationProblem(p){
 if(!['companion','both'].includes(p.profile_kind))return 'Choose Become a companion or Both.';
 if(!p.adult_confirmed||!p.boundaries_accepted)return 'Confirm and save your safety declarations before publishing.';
 if(String(p.bio||'').trim().length<20)return 'Write a bio of at least 20 characters before publishing.';
 if(!Array.isArray(p.categories)||!p.categories.length)return 'Choose at least one activity before publishing.';
 if(!Number.isInteger(p.hourly_rate)||p.hourly_rate<1||p.hourly_rate>100000)return 'Set a valid hourly companionship rate before publishing.';
 if(!p.avatar_path)return 'Add a profile photo or choose a Sathivo avatar before publishing.';
 return '';
}

export async function setupPublishing({client,user,onDraftChange,isCompanion,canShowGender}){
 const $=id=>document.getElementById(id);
 const status=$('listing-status'),publish=$('publish-listing'),gender=$('public-gender-consent'),view=$('view-listing');
 let busy=false,known=false,listing=null,draft=visibilityDraft(null),wasPublicAtSave=false;
 const same=(a,b)=>a.published===b.published&&a.showGender===b.showGender;
 const pending=()=>known&&!same(draft,visibilityDraft(listing));
 function render(){
  publish.setAttribute('aria-checked',String(known&&draft.published));
  gender.setAttribute('aria-checked',String(known&&draft.published&&draft.showGender));
  publish.disabled=busy||!known||!isCompanion();
  gender.disabled=busy||!known||!draft.published||!isCompanion()||!canShowGender();
  view.hidden=!(known&&listing?.published&&draft.published);
  $('publish-listing-description').textContent=!known?'Visibility unavailable':pending()?(draft.published?'Will be public after saving':'Will be private after saving'):draft.published?'Public profile enabled':'Hidden from Explore';
  $('public-gender-consent-description').textContent=!known?'Status unavailable':!draft.published?'Private':draft.showGender?'Show gender on public profile':'Private';
  publish.dataset.known=gender.dataset.known=String(known);
 }
 function change(action){
  const next=nextVisibility(draft,action,canShowGender());
  if(same(next,draft))return;
  draft=next;render();onDraftChange();
 }
 async function refresh({preserveDraft=false}={}){
  const {data,error}=await client.from('companion_listings').select('public_id,published,public_gender,photo_path,moderation_status').eq('user_id',user.id).maybeSingle();
  if(error){known=false;render();throw Error('Could not check listing status. Refresh to retry.');}
  listing=data||null;known=true;
  if(!preserveDraft)draft=visibilityDraft(listing);
  if(listing?.published)view.href='companion.html?id='+encodeURIComponent(listing.public_id);else view.removeAttribute('href');
  render();
 }
 // Hide first when opting out, and remove gender before a saved gender change
 // can reach an old public card through the database identity-sync trigger.
 async function prepareSave({photoChanged=false,applyVisibility=true}={}){
  if(!known)throw Error('Visibility could not be verified. Refresh before saving.');
  const previous=visibilityDraft(listing);
  await refresh({preserveDraft:true});
  if(!same(previous,visibilityDraft(listing))){
   draft=visibilityDraft(listing);render();onDraftChange();
   throw Error('Visibility changed in another session. Review Privacy and save again.');
  }
  wasPublicAtSave=listing?.published===true;
  if(!applyVisibility)return;
  if(listing?.published&&!draft.published){
   const {error}=await client.from('companion_listings').update({published:false,public_gender:null}).eq('user_id',user.id).select('public_id').single();
   if(error)throw Error('Could not hide your public profile. Try again.');
   listing={...listing,published:false,public_gender:null};
  }else if(listing?.published&&!draft.showGender&&listing.public_gender!=null){
   const {error}=await client.from('companion_listings').update({public_gender:null}).eq('user_id',user.id).select('public_id').single();
   if(error)throw Error('Could not hide your public gender. Try again.');
   listing={...listing,public_gender:null};
  }
  if(listing?.published&&draft.published&&photoChanged){
   const {error}=await client.from('companion_listings').update({published:false}).eq('user_id',user.id).select('public_id').single();
   if(error)throw Error('Could not prepare your public photo update. Try again.');
   listing={...listing,published:false};
  }
 }
 async function saveVisibility(p,{photoChanged=false,uploadedBlob=null}={}){
  if(!known)throw Error('Visibility could not be verified. Refresh before saving.');
  if(!draft.published||!['companion','both'].includes(p.profile_kind)){
   // No listing is ever created for a private profile.
   await refresh();
   if(listing?.published)throw Error('Could not confirm your profile is private.');
   return {published:false};
  }
  if(!p.avatar_path)throw Error('Add a profile photo or choose a Sathivo avatar before publishing.');
  const problem=publicationProblem(p);if(problem)throw Error(problem);
  const showGender=draft.showGender;
  const wasPublished=listing?.published===true;
  const row={user_id:user.id,published:true,photo_path:null,public_gender:showGender&&['male','female','other'].includes(p.gender)?p.gender:null};
  for(const k of ['display_name','bio','location_id','city_name','languages','interests','categories','meeting_mode','availability','hourly_rate'])row[k]=p[k];
  const target=isBuiltinAvatar(p.avatar_path)?p.avatar_path:user.id+'/avatar.webp';
  const replacePhoto=photoChanged||listing?.photo_path!==target||!wasPublished;
  // Do not repeatedly hide/re-publish an unchanged card or re-upload its photo.
  if(wasPublished&&replacePhoto){
   const {error}=await client.from('companion_listings').update({published:false}).eq('user_id',user.id).select('public_id').single();
   if(error)throw Error('Could not prepare publication. Try again.');
   listing={...listing,published:false};
  }
  if(isBuiltinAvatar(p.avatar_path))row.photo_path=p.avatar_path;
  else{
   row.photo_path=target;
   if(replacePhoto){
    let blob=uploadedBlob;
    if(!blob){const image=await client.storage.from('profile-photos').download(p.avatar_path);if(image.error||!image.data)throw Error('Could not prepare your public photo. Save again to retry.');blob=image.data;}
    const type=await encodedPhotoType(blob);
    if(!type)throw Error('The saved photo format is unsupported. Choose a new photo and save again.');
    // Keep the legacy stable avatar.webp object key for existing RLS and profile links.
    // The actual response MIME type is determined by the encoded bytes.
    if(blob.type!==type)blob=blob.slice(0,blob.size,type);
    const upload=await client.storage.from('listing-photos').upload(target,blob,{upsert:true,contentType:type,cacheControl:'0'});
    if(upload.error)throw Error('Public photo upload failed. Save again to retry.');
   }
  }
  const saved=await client.from('companion_listings').upsert(row,{onConflict:'user_id'}).select('public_id').single();
  if(saved.error||!saved.data)throw Error('Could not publish your profile. Save again to retry.');
  if(isBuiltinAvatar(p.avatar_path)&&listing?.photo_path===user.id+'/avatar.webp'){
   try{await client.storage.from('listing-photos').remove([user.id+'/avatar.webp']);}catch{}
  }
  if(['male','female','other'].includes(p.gender)){
   try{await client.from('companion_gender_prompt_responses').upsert({user_id:user.id,show_gender:!!showGender},{onConflict:'user_id',ignoreDuplicates:true});}catch{}
  }
  await refresh();
  if(!listing?.published)throw Error('Could not confirm publication. Save again to retry.');
  // Existing nearby push remains restricted to first publication/re-enabling.
  if(!wasPublicAtSave&&saved.data.public_id){
   void client.functions.invoke('send-nearby-push',{body:{public_id:saved.data.public_id}}).catch(()=>{});
  }
  return {published:true,active:listing.moderation_status==='active'};
 }
 // A section save may refresh an already public card, never enable visibility.
 async function syncExistingPublic(p,{refreshPhoto=false,uploadedBlob=null}={}){
  if(!known||!wasPublicAtSave||!listing?.published||pending()||listing.moderation_status!=='active')return {synced:false};
  const before=visibilityDraft(listing);
  await refresh({preserveDraft:true});
  if(!same(before,visibilityDraft(listing))||pending()||!listing?.published||listing.moderation_status!=='active')return {synced:false};
  const problem=publicationProblem(p);
  if(problem)throw Error(problem+' Your public details were not updated.');
  const target=isBuiltinAvatar(p.avatar_path)?p.avatar_path:user.id+'/avatar.webp';
  const previousPhoto=listing.photo_path;
  if(!isBuiltinAvatar(target)){
   if(p.avatar_path!==user.id+'/avatar.webp')throw Error('Choose your own profile photo before updating your public profile.');
   if(refreshPhoto||previousPhoto!==target){
    let blob=uploadedBlob;
    if(!blob){const image=await client.storage.from('profile-photos').download(p.avatar_path);if(image.error||!image.data)throw Error('Public photo could not be prepared. Save again to retry.');blob=image.data;}
    const type=await encodedPhotoType(blob);
    if(!type)throw Error('The saved photo format is unsupported. Choose a new photo and save again.');
    if(blob.type!==type)blob=blob.slice(0,blob.size,type);
    const upload=await client.storage.from('listing-photos').upload(target,blob,{upsert:true,contentType:type,cacheControl:'0'});
    if(upload.error)throw Error('Public photo upload failed. Save again to retry.');
   }
  }
  const row={photo_path:target};
  for(const k of ['display_name','bio','location_id','city_name','languages','interests','categories','meeting_mode','availability','hourly_rate'])row[k]=p[k];
  // Match the original visibility and moderation; do not write published or gender.
  let update=client.from('companion_listings').update(row).eq('user_id',user.id).eq('published',true).eq('moderation_status','active');
  update=before.showGender?update.not('public_gender','is',null):update.is('public_gender',null);
  const saved=await update.select('public_id').maybeSingle();
  if(saved.error||!saved.data)throw Error('Public profile was not updated. Review Privacy and save again.');
  await refresh({preserveDraft:true});
  if(!listing?.published||listing.moderation_status!=='active'||pending())throw Error('Visibility changed in another session. Review Privacy and save again.');
  if(isBuiltinAvatar(target)&&previousPhoto===user.id+'/avatar.webp'){
   try{await client.storage.from('listing-photos').remove([previousPhoto]);}catch{}
  }
  return {synced:true};
 }
 publish.addEventListener('click',()=>{if(!busy&&known&&isCompanion())change('public');});
 gender.addEventListener('click',()=>{if(!busy&&known&&isCompanion())change('gender');});
 try{await refresh();}catch(error){status.textContent=error.message;}
 return {
  isKnown:()=>known,hasListing:()=>known&&!!listing,selection:()=>({...draft}),hasPendingChanges:pending,
  setBusy(value){busy=value;render();},
  syncMode(){if(!isCompanion())change('private');else if(!canShowGender())change('no-gender');render();},
  prepareSave,saveVisibility,syncExistingPublic,
  async recover(){try{await refresh({preserveDraft:true});}catch{}}
 };
}
