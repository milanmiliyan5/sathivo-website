import { setupPublishing } from './listing-publish.js?v=20261002-1';
import { authConfig } from './auth-config.js?v=20260926-1';
const $ = id => document.getElementById(id);
const form = $('profile-form');
const categories = ['Conversation','Coffee','Movies','Shopping','Events','Walking','Online chat','Phone conversation'];
let client, user, locations = [], avatarPath = null, dirty = false;
function message(text, error=false) { $('profile-status').textContent=text; $('profile-status').dataset.error=String(error); }
function options(select, items, placeholder) {
  select.replaceChildren(new Option(placeholder,''));
  items.forEach(([value,label])=>select.add(new Option(label,String(value))));
}
function states() { options($('state'), [...new Set(locations.map(r=>r.state))].sort().map(v=>[v,v]),'Choose your state / UT'); }
function districts() { options($('district'), [...new Set(locations.filter(r=>r.state===$('state').value).map(r=>r.district))].sort().map(v=>[v,v]),'Choose district'); cities(); }
function cities() { options($('location_id'), locations.filter(r=>r.state===$('state').value&&r.district===$('district').value).map(r=>[r.id,r.city]),'Choose city / town'); }
$('state').addEventListener('change',districts);
$('district').addEventListener('change',cities);
categories.forEach(value=>{
  const label=document.createElement('label'), input=document.createElement('input');
  input.type='checkbox';input.name='categories';input.value=value;
  label.append(input,document.createTextNode(value));$('categories').append(label);
});
form.addEventListener('input',()=>{dirty=true;});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
async function showPhoto(path) {
  const {data,error}=await client.storage.from('profile-photos').createSignedUrl(path,300);
  if(error) { message('Profile loaded, but the photo could not load. You can try again by refreshing.',true); return; }
  $('avatar').src=data.signedUrl;$('avatar').hidden=false;
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
  for(const name of ['display_name','profile_kind','bio','languages','interests','meeting_mode','availability']) row[name]=String(values.get(name)||'').trim();
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
    const {data,error}=await client.from('member_profiles').upsert(row,{onConflict:'user_id'}).select('user_id').single();
    if(error||!data)throw Error('Profile could not be saved. Check your connection and try again.');
    dirty=false;$('photo').value='';message('Your profile is saved. You can come back and edit it anytime.');
    if(avatarPath)await showPhoto(avatarPath);
  }catch(error){message(error.message||'Could not save your profile. Please try again.',true);}
  finally{$('fields').disabled=false;$('profile-status').focus();}
});
async function init(){
  try{
    if(!authConfig.accountsEnabled||!globalThis.supabase)throw Error('Profile services could not load. Please refresh.');
    client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
    const result=await client.auth.getUser();user=result.data?.user;
    if(!user){message('Sign in to create or edit your free profile.');$('signin').hidden=false;return;}
    const [loc,profile]=await Promise.all([client.from('profile_locations').select('*').order('state'),client.from('member_profiles').select('*').eq('user_id',user.id).maybeSingle()]);
    if(loc.error||profile.error)throw Error('Your profile could not load. Refresh to retry; your saved details are safe.');
    locations=loc.data;states();districts();
    const p=profile.data;
    if(p){
      for(const name of ['display_name','profile_kind','bio','languages','interests','meeting_mode','availability'])$(name).value=p[name]||'';
      const loc=locations.find(r=>r.id===p.location_id);
      if(loc){$('state').value=loc.state;districts();$('district').value=loc.district;cities();$('location_id').value=String(loc.id);}
      form.querySelectorAll('[name=categories]').forEach(input=>input.checked=p.categories.includes(input.value));
      form.elements.adult_confirmed.checked=p.adult_confirmed;form.elements.boundaries_accepted.checked=p.boundaries_accepted;
      avatarPath=p.avatar_path;
    }else{$('display_name').value=user.user_metadata?.display_name||'';}
    $('fields').disabled=false;message(p?'Your saved profile. Make it feel like you.':'Let’s create your free profile.');
    if(avatarPath)await showPhoto(avatarPath);
    await setupPublishing({client,user,isDirty:()=>dirty});
    client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){dirty=false;location.replace('account.html');}});
  }catch(error){message(error.message||'Profile services are unavailable. Please refresh.',true);}
}
void init();
