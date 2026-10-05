import { isBuiltinAvatar } from './avatar-utils.js?v=20261006-1';
export async function setupPublishing({client,user,isDirty}) {
 const $=id=>document.getElementById(id);
 const panel=$('publication'), status=$('listing-status'), publish=$('publish-listing'), hide=$('hide-listing'), view=$('view-listing');
 panel.hidden=false;let busy=false;
 async function refresh(){
  const {data,error}=await client.from('companion_listings').select('public_id,published').eq('user_id',user.id).maybeSingle();
  if(error)throw Error('Could not load listing status. Refresh to retry.');
  hide.hidden=!data?.published;view.hidden=!data?.published;
  status.textContent=data?.published?'Your listing is public.':'Your listing is hidden.';
  if(data?.published)view.href='companion.html?id='+encodeURIComponent(data.public_id);
 }
 async function run(task){
  if(busy||$('fields').disabled)return;busy=true;publish.disabled=hide.disabled=true;$('fields').disabled=true;
  try{await task();}catch(error){status.textContent=error.message||'Could not update your listing. Try again.';}
  finally{busy=false;publish.disabled=hide.disabled=false;$('fields').disabled=false;status.focus();}
 }
 publish.addEventListener('click',()=>void run(async()=>{
  if(isDirty())throw Error('Save your profile changes first, then publish.');
  if(!$('publish-consent').checked)throw Error('Confirm that your saved profile details and photo/avatar can be public.');
  status.textContent='Publishing your saved profile…';
  const {data:p,error}=await client.from('member_profiles').select('*').eq('user_id',user.id).single();
  if(error||!p)throw Error('Save your profile first.');
  if(!['companion','both'].includes(p.profile_kind))throw Error('Choose Become a companion or Both, then save.');
  if(p.bio.trim().length<20||!p.categories.length)throw Error('Save a bio of at least 20 characters and select at least one category.');
  if(!Number.isInteger(p.hourly_rate)||p.hourly_rate<1||p.hourly_rate>100000)throw Error('Set and save your hourly companionship rate before publishing.');
  if(!p.avatar_path)throw Error('Add a profile photo or choose a Sathivo avatar before publishing.');
  const row={user_id:user.id,published:true,photo_path:null};
  for(const k of ['display_name','bio','location_id','languages','interests','categories','meeting_mode','availability','hourly_rate'])row[k]=p[k];
  // Hide before replacing the public photo so a failed update cannot expose a new photo on an old listing.
  const hidden=await client.from('companion_listings').update({published:false}).eq('user_id',user.id);
  if(hidden.error)throw Error('Could not prepare publication. Try again.');
  hide.hidden=view.hidden=true;
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
  $('publish-consent').checked=false;await refresh();
 }));
 hide.addEventListener('click',()=>void run(async()=>{
  const {error}=await client.from('companion_listings').update({published:false}).eq('user_id',user.id).select('public_id').single();
  if(error)throw Error('Could not hide your listing. Try again.');
  await refresh();
 }));
 try{await refresh();}catch(error){status.textContent=error.message;}
}