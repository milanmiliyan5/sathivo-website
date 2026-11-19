const EMAIL_SIGNATURE = "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-collapse:collapse;margin-top:18px;border-top:1px solid #eadce5;font-family:Arial,Helvetica,sans-serif;color:#33242d\"><tr><td style=\"padding:12px 10px 0 0;vertical-align:middle\"><a href=\"https://sathivo.co/\" style=\"text-decoration:none\"><img src=\"https://sathivo.co/assets/sathivo-email-logo.png\" alt=\"Sathivo\" width=\"44\" height=\"44\" style=\"display:block;width:44px;height:44px;border:0;border-radius:8px\"></a></td><td style=\"padding:12px 0 0;vertical-align:middle\"><div style=\"font-size:14px;font-weight:bold;line-height:19px;color:#8e3655\">Team Sathivo</div><div style=\"font-size:11px;line-height:16px;color:#685765\">Real Company. Real Moments.</div><a href=\"https://sathivo.co/\" style=\"font-size:11px;line-height:16px;color:#8e3655;text-decoration:underline\">sathivo.co</a></td></tr></table>";
import {createClient} from "npm:@supabase/supabase-js@2.116.0";
import webpush from "npm:web-push@3.6.7";
import {deliverAndroid} from "./fcm.ts";
function serviceKey(){const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}").default??""}catch{return ""}}
const title="Pending booking reminder";
const body="You have a pending booking request. Please review and respond if the request is still relevant.";
async function current(admin:any,row:any){
 const {data:b,error}=await admin.from("booking_requests").select("id,customer_id,companion_id,status,created_at").eq("id",row.booking_id).maybeSingle();
 if(error||!b||b.status!=="pending"||b.companion_id!==row.target_user_id||Date.now()-Date.parse(b.created_at)>=7*86400000)return false;
 const {count,error:be}=await admin.from("user_blocks").select("blocker_id",{count:"exact",head:true}).or("and(blocker_id.eq."+b.customer_id+",blocked_id.eq."+b.companion_id+"),and(blocker_id.eq."+b.companion_id+",blocked_id.eq."+b.customer_id+")");
 if(be||count)return false;
 const {data:u,error:ue}=await admin.auth.admin.getUserById(b.companion_id);
 return !ue&&!!u?.user&&(!u.user.banned_until||Date.parse(u.user.banned_until)<=Date.now());
}
async function deliverWeb(admin:any,row:any){
 const {data,error}=await admin.from("push_subscriptions").select("endpoint,p256dh,auth_key").eq("user_id",row.target_user_id).limit(20);
 if(error)throw Error("Web subscription lookup failed");
 if(!data?.length)return 0;
 const {data:config,error:ce}=await admin.rpc("get_vapid_config_server");
 const keys=Array.isArray(config)?config[0]:config;
 if(ce||!keys?.public_key||!keys?.private_key)throw Error("VAPID unavailable");
 webpush.setVapidDetails("mailto:no-reply@auth.sathivo.co",keys.public_key,keys.private_key);
 let sent=0;
 await Promise.all(data.map(async(s:any)=>{
  try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth_key}},JSON.stringify({title,body,url:"requests.html?id="+row.booking_id,tag:"sathivo-reminder-"+row.booking_id}),{TTL:300,urgency:"normal",timeout:8000});sent++}
  catch(e:any){if([404,410].includes(Number(e?.statusCode)))await admin.from("push_subscriptions").delete().eq("endpoint",s.endpoint).eq("user_id",row.target_user_id);else console.error("Reminder web push unavailable")}
 }));
 return sent;
}
async function deliverEmail(admin:any,row:any){
 if(!row.email_due)return "not_due";
 if(!await current(admin,row))return "skipped_not_pending";
 const key=Deno.env.get("RESEND_API_KEY");
 if(!key)return "not_configured";
 const {data,error}=await admin.auth.admin.getUserById(row.target_user_id);
 const user=data?.user;
 if(error||!user?.email||!user.email_confirmed_at)return "unverified_or_unavailable";
 const link="https://sathivo.co/requests.html?id="+row.booking_id;
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"sathivo-booking-reminder-"+row.booking_id},body:JSON.stringify({from:"Sathivo <no-reply@auth.sathivo.co>",to:[user.email],subject:"Reminder: A Sathivo booking request is waiting",text:"You have a pending booking request. Please review the request and accept or decline if it is still relevant. If the proposed time has passed, you can decline or review whether a new plan is appropriate.\n\nReview request: "+link+"\n\nSathivo · 18+ · Strictly platonic\nNo further automatic reminders after seven days or once the request is resolved.",html:"<div style='font-family:Arial,sans-serif;color:#492637;max-width:520px;margin:auto;padding:24px'><h2>Sathivo ♡</h2><h3>A booking request is waiting</h3><p>Please review your pending request and accept or decline if it is still relevant. If the proposed time has passed, you can decline or review whether a new plan is appropriate.</p><p><a style='display:inline-block;background:#963b60;color:white;padding:12px 18px;border-radius:8px;text-decoration:none' href='"+link+"'>Review request</a></p><p>Sign in with your Sathivo account. Never share passwords or OTPs.</p><p>Sathivo · 18+ · Strictly platonic</p>"+EMAIL_SIGNATURE+"</div>"}),signal:AbortSignal.timeout(10000)});
 return response.ok?"provider_accepted":"provider_rejected";
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
 const token=req.headers.get("x-sathivo-scheduler")??"";
 if(!/^[0-9a-f-]{72}$/i.test(token))return Response.json({error:"Unauthorized"},{status:401});
 const key=serviceKey();
 if(!key)return Response.json({error:"Service unavailable"},{status:503});
 const admin=createClient(Deno.env.get("SUPABASE_URL")??"",key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:rows,error}=await admin.rpc("claim_scheduled_booking_reminders",{p_token:token});
 if(error)return Response.json({error:"Unauthorized or unavailable"},{status:error.code==="42501"?401:503});
 await Promise.all((rows??[]).map(async(row:any)=>{
  let web=0,android=0,email=row.email_due?"not_attempted":"not_due";
  try{
   if(await current(admin,row)){
    const results=await Promise.allSettled([deliverWeb(admin,row),deliverAndroid(admin,row.target_user_id),deliverEmail(admin,row)]);
    if(results[0].status==="fulfilled")web=Number(results[0].value)||0;
    if(results[1].status==="fulfilled")android=Number(results[1].value)||0;
    email=results[2].status==="fulfilled"?String(results[2].value):"failed";
   }else email="skipped_not_pending";
  }catch{email="failed"}
  const {error:finish}=await admin.rpc("finish_scheduled_booking_reminder",{p_booking:row.booking_id,p_stage:row.stage,p_email:email,p_web:web,p_android:android});
  if(finish)console.error("Reminder result recording unavailable");
 }));
 return Response.json({ok:true,processed:rows?.length??0},{headers:{"Cache-Control":"no-store"}});
});