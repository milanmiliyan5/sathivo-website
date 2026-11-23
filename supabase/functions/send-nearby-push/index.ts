import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import webpush from "npm:web-push@3.6.7";

// Authenticated, newly published companion can notify only matching opted-in members.
const origins=new Set(["https://sathivo.co","https://www.sathivo.co","https://app.sathivo.co","https://milanmiliyan5.github.io"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm=(v:string)=>String(v||"").trim().replace(/\s+/g," ").toLowerCase();
const key=()=>{
 const raw=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"";
 try{const val=JSON.parse(raw);if(val.default)return String(val.default)}catch{}
 return Deno.env.get("SUPABASE_ANON_KEY")||"";
};
const secret=()=>{
 const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;
 try{const val=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"");if(val.default)return String(val.default)}catch{}
 return "";
};
function headers(req:Request){
 const origin=req.headers.get("origin")||"";
 const allowed=origins.has(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
 return {"Access-Control-Allow-Origin":allowed?origin:"https://sathivo.co","Vary":"Origin",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
 "Content-Type":"application/json"};
}
async function configureVapid(admin:any){
 const {data,error}=await admin.rpc("get_vapid_config_server");if(error)throw error;
 const row=Array.isArray(data)?data[0]:data;
 if(String(row?.public_key||"").length!==87||String(row?.private_key||"").length<40)throw Error("Push keys unavailable");
 webpush.setVapidDetails("mailto:no-reply@auth.sathivo.co",String(row.public_key),String(row.private_key));
}
function output(req:Request,data:unknown,status=200){return Response.json(data,{status,headers:headers(req)})}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:headers(req)});
 if(req.method!=="POST")return output(req,{error:"Method not allowed"},405);
 const origin=req.headers.get("origin")||"";
 if(origin&&!origins.has(origin)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))return output(req,{error:"Origin not allowed"},403);
 const authorization=req.headers.get("Authorization")||"";
 const token=authorization.replace(/^Bearer\s+/i,"");
 if(!token||token===authorization)return output(req,{error:"Sign in required"},401);
 try{
  const body=await req.json().catch(()=>({}));
  const id=String(body?.public_id||"");
  if(!uuid.test(id))return output(req,{error:"Invalid profile id"},400);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const pub=key(),priv=secret();
  if(!url||!pub||!priv)throw Error("Push service unavailable");
  const client=createClient(url,pub,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await client.auth.getUser(token);
  if(authError||!auth.user)return output(req,{error:"Invalid session"},401);
  const actor=auth.user.id;
  const admin=createClient(url,priv,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:listing,error:listingErr}=await admin.from("companion_listings")
    .select("user_id,public_id,display_name,published,moderation_status,adult_confirmed,boundaries_accepted,city_name,location_id")
    .eq("public_id",id).maybeSingle();
  if(listingErr||!listing||listing.user_id!==actor||!listing.published||listing.moderation_status!=="active"||
     !listing.adult_confirmed||!listing.boundaries_accepted)return output(req,{error:"Published companion unavailable"},404);
  const {data:announcement,error:annErr}=await admin.from("nearby_listing_announcements")
    .select("id,created_at,state,district,city_key")
    .eq("listing_user_id",actor).eq("listing_public_id",id)
    .order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(annErr)throw annErr;
  // Do not resend old announcements when a member opens an old profile.
  if(!announcement||Date.now()-new Date(announcement.created_at).getTime()>3600000)
   return output(req,{ok:true,sent:0,reason:"no_recent_announcement"});
  const {data:notices,error:noticesErr}=await admin.from("notifications")
    .select("id,user_id").eq("kind","nearby").eq("link","companion.html?id="+id)
    .gte("created_at",announcement.created_at).order("created_at",{ascending:true}).limit(250);
  if(noticesErr)throw noticesErr;
  const recipients=[...new Set((notices||[]).map((x:any)=>x.user_id).filter((x:any)=>x&&x!==actor))];
  if(!recipients.length)return output(req,{ok:true,sent:0,reason:"no_nearby_recipients"});
  const [prefsRes,profileRes,blockRes,subRes]=await Promise.all([
   admin.from("nearby_alert_preferences").select("user_id,in_app_enabled,push_enabled").in("user_id",recipients),
   admin.from("member_profiles").select("user_id,city_name,location_id,adult_confirmed,boundaries_accepted").in("user_id",recipients),
   admin.from("user_blocks").select("blocker_id,blocked_id").or("blocker_id.eq."+actor+",blocked_id.eq."+actor),
   admin.from("push_subscriptions").select("user_id,endpoint,p256dh,auth_key").in("user_id",recipients)
  ]);
  if(prefsRes.error||profileRes.error||blockRes.error||subRes.error)
   throw prefsRes.error||profileRes.error||blockRes.error||subRes.error;
  const prefs=new Map((prefsRes.data||[]).map((x:any)=>[x.user_id,x]));
  const profiles=new Map((profileRes.data||[]).map((x:any)=>[x.user_id,x]));
  const blocked=new Set((blockRes.data||[]).map((x:any)=>x.blocker_id===actor?x.blocked_id:x.blocker_id));
  const locIds=[...new Set((profileRes.data||[]).map((x:any)=>x.location_id).filter(Boolean))];
  let locs:any[]=[];
  if(locIds.length){const locRes=await admin.from("profile_locations").select("id,state,district").in("id",locIds);if(locRes.error)throw locRes.error;locs=locRes.data||[];}
  const locations=new Map(locs.map((x:any)=>[x.id,x]));
  const eligible=new Set(recipients.filter((recipient:string)=>{
   const pref:any=prefs.get(recipient),member:any=profiles.get(recipient),loc:any=locations.get(member?.location_id);
   return pref?.in_app_enabled!==false&&pref?.push_enabled===true&&!blocked.has(recipient)&&
    member?.adult_confirmed===true&&member?.boundaries_accepted===true&&
    norm(member?.city_name)===announcement.city_key&&
    loc?.state===announcement.state&&loc?.district===announcement.district;
  }));
  const targetNotices=new Map((notices||[]).filter((n:any)=>eligible.has(n.user_id)).map((n:any)=>[n.user_id,n]));
  const devices=(subRes.data||[]).filter((s:any)=>eligible.has(s.user_id));
  if(!devices.length)return output(req,{ok:true,sent:0,reason:"no_opted_in_devices"});
  await configureVapid(admin);
  let sent=0,failed=0,skipped=0;
  // Small batches avoid a large concurrent push burst for the same location.
  for(let i=0;i<devices.length;i+=5){
   const batch=devices.slice(i,i+5);
   await Promise.all(batch.map(async(sub:any)=>{
    const notice:any=targetNotices.get(sub.user_id);
    if(!notice)return;
    let claimed=false;
    try{
     const {data:rows,error:claimErr}=await admin.from("nearby_push_delivery_events")
      .upsert({notification_id:notice.id,endpoint:sub.endpoint},
       {onConflict:"notification_id,endpoint",ignoreDuplicates:true})
      .select("notification_id");
     if(claimErr)throw claimErr;
     claimed=!!rows?.length;
     if(!claimed){skipped++;return}
     await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},
      JSON.stringify({title:"A new Sathivo companion near you 📍",
       body:(listing.display_name||"A new companion")+" has joined your area. Explore their profile.",
       url:"companion.html?id="+id,tag:"sathivo-nearby-"+id}),
      {TTL:1800,urgency:"normal"});
     sent++;
    }catch(error){
     const status=Number((error as any)?.statusCode||0);
     if(status===404||status===410){
      await admin.from("push_subscriptions").delete().eq("endpoint",sub.endpoint);
     }else{
      failed++;console.error("nearby-push-delivery-failed",status,(error as any)?.message||"unknown");
      if(claimed)await admin.from("nearby_push_delivery_events")
       .delete().eq("notification_id",notice.id).eq("endpoint",sub.endpoint);
     }
    }
   }));
  }
  return output(req,{ok:true,sent,failed,skipped});
 }catch(error){console.error("nearby-push-failed",(error as Error)?.message||"unknown");return output(req,{error:"Nearby push delivery unavailable"},500)}
});