import { createClient } from "npm:@supabase/supabase-js@2.116.0";

// Triggered only by an authenticated companion after a successful public publish.
// The database has already queued consented, same-city recipients.
const ORIGINS=new Set(["https://sathivo.co","https://www.sathivo.co","https://app.sathivo.co","https://milanmiliyan5.github.io"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm=(v:string)=>v.trim().replace(/\s+/g," ").toLocaleLowerCase("en-IN");
function cors(req:Request){
 const origin=req.headers.get("origin")||"";
 const ok=ORIGINS.has(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
 return {"Access-Control-Allow-Origin":ok?origin:"https://sathivo.co","Vary":"Origin","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type","Content-Type":"application/json"};
}
function pubkey(){
 const keys=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"";
 try {const j=JSON.parse(keys);if(j.default)return String(j.default)}catch{}
 return Deno.env.get("SUPABASE_ANON_KEY")||"";
}
function servicekey(){
 const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(legacy)return legacy;
 const keys=Deno.env.get("SUPABASE_SECRET_KEYS")||"";
 try{const j=JSON.parse(keys);if(j.default)return String(j.default)}catch{}
 return "";
}
function escapeHtml(s:string){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}
function dateIst(){return new Date(Date.now()+330*60000).toISOString().slice(0,10)}
function html(name:string,city:string,href:string){
 const n=escapeHtml(name),c=escapeHtml(city),url=escapeHtml(href);
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
 '<body style="margin:0;background:#fff6fa;font-family:Arial,sans-serif;color:#362337"><div style="max-width:550px;margin:26px auto;background:#fff;padding:28px;border:1px solid #f0d5e4;border-radius:20px">'+
 '<div style="font-size:26px;font-weight:800;color:#a33263">♡ Sathivo</div><p style="color:#865773;font-size:12px;letter-spacing:1px">GOOD COMPANY. REAL MOMENTS.</p>'+
 '<h1 style="font-size:24px">A new companion in '+c+' 💌</h1><p style="line-height:1.7">'+n+' has published a new companion profile in your area on Sathivo.</p>'+
 '<p style="line-height:1.7">Interested in a coffee outing, a conversation or a shared social plan? You can explore their public profile and decide whether to send a request.</p>'+
 '<p><a href="'+url+'" style="display:inline-block;padding:13px 21px;border-radius:12px;color:white;text-decoration:none;background:#9c3e6a;font-weight:700">Explore companion profile →</a></p>'+
 '<p style="font-size:13px;color:#775a6b;line-height:1.7">This is a nearby discovery update, not a confirmed booking or a promise of availability. Companions set their own rates. 18+ and strictly platonic.</p>'+
 '<hr style="border:0;border-top:1px solid #f1dfea"><p style="font-size:12px;color:#805f72;line-height:1.6">You receive this because you enabled Sathivo nearby email alerts. Maximum one nearby email per day. <a href="https://sathivo.co/notifications.html#nearby-alerts">Manage or turn off alerts</a>.<br>Sathivo · https://sathivo.co</p></div></body></html>';
}
function response(req:Request,data:unknown,status=200){return Response.json(data,{status,headers:cors(req)})}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
 if(req.method!=="POST")return response(req,{error:"Method not allowed"},405);
 const origin=req.headers.get("origin")||"";
 if(origin&&!ORIGINS.has(origin)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))return response(req,{error:"Origin not allowed"},403);
 const authorization=req.headers.get("authorization")||"";
 const token=authorization.replace(/^Bearer\s+/i,"");
 if(!authorization||token===authorization)return response(req,{error:"Sign in required"},401);
 const url=Deno.env.get("SUPABASE_URL")||"",pub=pubkey(),priv=servicekey(),resend=Deno.env.get("RESEND_API_KEY")||"";
 if(!url||!pub||!priv)return response(req,{error:"Email service not configured"},503);
 try{
   const body=await req.json().catch(()=>({}));
   const id=String(body?.public_id||"");
   if(!UUID.test(id))return response(req,{error:"Invalid profile"},400);
   const authClient=createClient(url,pub,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
   const {data:auth,error:authError}=await authClient.auth.getUser(token);
   const actor=auth?.user;
   if(authError||!actor)return response(req,{error:"Session expired"},401);
   const admin=createClient(url,priv,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:listing,error:listingError}=await admin.from("companion_listings")
    .select("user_id,public_id,display_name,published,moderation_status,city_name")
    .eq("public_id",id).maybeSingle();
   if(listingError||!listing||listing.user_id!==actor.id||listing.published!==true||listing.moderation_status!=="active")
    return response(req,{error:"Public companion profile not found"},404);
   const {data:ann,error:annError}=await admin.from("nearby_listing_announcements")
    .select("id,state,district,city,city_key,created_at")
    .eq("listing_user_id",actor.id).eq("listing_public_id",id).order("created_at",{ascending:false}).limit(1).maybeSingle();
   if(annError||!ann)return response(req,{ok:true,sent:0,reason:"no_new_announcement"});
   if(Date.now()-new Date(ann.created_at).getTime()>86400000)return response(req,{ok:true,sent:0,reason:"announcement_not_recent"});
   const {data:queued,error:queuedError}=await admin.from("nearby_email_queue")
    .select("id,recipient_id").eq("announcement_id",ann.id).eq("status","pending").limit(75);
   if(queuedError)throw queuedError;
   if(!(queued||[]).length)return response(req,{ok:true,sent:0,reason:"no_opted_in_recipients"});
   if(!resend)return response(req,{error:"Nearby email service not configured",queued:queued.length},503);
   let sent=0,skipped=0,failed=0;
   for(const job of queued||[]){
    try{
     // Check opt-in again at send time. A user can unsubscribe after a queue entry is created.
     const [prefR,profileR,accountR,block1,block2]=await Promise.all([
      admin.from("nearby_alert_preferences").select("email_enabled").eq("user_id",job.recipient_id).maybeSingle(),
      admin.from("member_profiles").select("city_name,location_id,adult_confirmed,boundaries_accepted").eq("user_id",job.recipient_id).maybeSingle(),
      admin.auth.admin.getUserById(job.recipient_id),
      admin.from("user_blocks").select("blocker_id").eq("blocker_id",job.recipient_id).eq("blocked_id",actor.id).limit(1),
      admin.from("user_blocks").select("blocker_id").eq("blocker_id",actor.id).eq("blocked_id",job.recipient_id).limit(1)
     ]);
     const target=accountR.data?.user,member=profileR.data;
     let matches=!!(prefR.data?.email_enabled&&target?.email_confirmed_at&&target?.email&&member?.adult_confirmed&&member?.boundaries_accepted&&norm(member.city_name||"")===ann.city_key&&!(block1.data||[]).length&&!(block2.data||[]).length);
     if(matches){
      const loc=await admin.from("profile_locations").select("state,district").eq("id",member.location_id).maybeSingle();
      matches=!!(loc.data?.state===ann.state&&loc.data?.district===ann.district);
     }
     if(!matches){
      await admin.from("nearby_email_queue").update({status:"skipped"}).eq("id",job.id).eq("status","pending");
      skipped++;continue;
     }
     // One email per recipient per India-time calendar day (atomic UNIQUE constraint).
     const day=dateIst();
     const claim=await admin.from("nearby_email_daily_limit").insert({recipient_id:job.recipient_id,day_ist:day});
     if(claim.error){
      if(claim.error.code==="23505"){skipped++;continue;}
      throw claim.error;
     }
     const href="https://sathivo.co/companion.html?id="+encodeURIComponent(id);
     let success=false;
     try{
      const result=await fetch("https://api.resend.com/emails",{
       method:"POST",headers:{"Authorization":"Bearer "+resend,"Content-Type":"application/json","Idempotency-Key":"sathivo-nearby-"+job.id},
       body:JSON.stringify({
        from:Deno.env.get("BOOKING_EMAIL_FROM")||"Sathivo <no-reply@auth.sathivo.co>",
        to:[target.email],
        subject:"A new Sathivo companion in "+ann.city+" 💌",
        html:html(listing.display_name||"A Sathivo member",ann.city,href),
        text:"A new public Sathivo companion in "+ann.city+": "+(listing.display_name||"Sathivo member")+
         ". Explore: "+href+"\n\nNo booking is confirmed. 18+ strictly platonic. You enabled these updates. Maximum one email per day. Manage alerts: https://sathivo.co/notifications.html#nearby-alerts"
       })
      });
      if(!result.ok){console.error("nearby-email-provider-error",result.status);throw Error("Email provider rejected delivery")}
      const delivery=await result.json().catch(()=>({}));
      await admin.from("nearby_email_queue").update({status:"sent",sent_at:new Date().toISOString(),provider_message_id:String(delivery.id||"")||null}).eq("id",job.id);
      success=true;sent++;
     }finally{
      if(!success){
       // If the provider request failed, allow safe retry later.
       await admin.from("nearby_email_daily_limit").delete().eq("recipient_id",job.recipient_id).eq("day_ist",day);
      }
     }
    }catch(e){
     failed++;console.error("nearby-email-job-failed",e instanceof Error?e.message:"unknown");
    }
   }
   return response(req,{ok:true,sent,skipped,failed});
 }catch(e){console.error("nearby-email-failed",e instanceof Error?e.message:"unknown");return response(req,{error:"Unable to process nearby alerts"},500)}
});