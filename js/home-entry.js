import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {authConfig} from './auth-config.js?v=20260926-1';

// Profile routing is UX only: existing auth and database access rules remain authoritative.
export function profileReady(p){
 const text=(v,n=2)=>typeof v==='string'&&v.trim().length>=n;
 if(!p||!['customer','companion','both'].includes(p.profile_kind))return false;
 if(!text(p.display_name)||!['male','female','other','prefer_not_to_say'].includes(p.gender)
   ||!Number.isInteger(p.location_id)||p.location_id<1||!text(p.city_name)||!text(p.languages)
   ||p.adult_confirmed!==true||p.boundaries_accepted!==true)return false;
 if(p.profile_kind==='customer')return true;
 return text(p.bio,20)&&Array.isArray(p.categories)&&p.categories.length>0
   &&Number.isInteger(p.hourly_rate)&&p.hourly_rate>=1&&p.hourly_rate<=100000&&text(p.avatar_path,1);
}
export async function resolveEntry(client){
 const session=await client.auth.getSession();
 if(session.error||!session.data?.session)return null;
 const identity=await client.auth.getUser();
 const user=identity.data?.user;
 if(identity.error||!user?.id||!user.email_confirmed_at)return null;
 const {data,error}=await client.from('member_profiles')
  .select('profile_kind,display_name,gender,location_id,city_name,languages,adult_confirmed,boundaries_accepted,bio,categories,hourly_rate,avatar_path')
  .eq('user_id',user.id).maybeSingle();
 if(error)return null;
 return profileReady(data)?'companions.html':'profile.html';
}
async function init(){
 const root=document.documentElement;
 const pending=()=>root.classList.contains('sathivo-entry-pending');
 if(!pending())return;
 try{
  if(!authConfig.accountsEnabled)return;
  const client=await getSathivoClient();
  if(!pending())return;
  const destination=await resolveEntry(client);
  // Do not redirect unexpectedly after the preflight deadline or a user's navigation.
  if(destination&&pending()){
   location.replace(new URL(destination,location.href).href);
   return;
  }
 }catch{/* Guest Home stays available when auth/profile services are unavailable. */}
 root.classList.remove('sathivo-entry-pending');
}
void init();
