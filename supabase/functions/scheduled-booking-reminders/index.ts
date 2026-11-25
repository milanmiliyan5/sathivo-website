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
  let web=0,android=0; const email="disabled";
  try{
   if(await current(admin,row)){
    const results=await Promise.allSettled([deliverWeb(admin,row),deliverAndroid(admin,row.target_user_id)]);
    if(results[0].status==="fulfilled")web=Number(results[0].value)||0;
    if(results[1].status==="fulfilled")android=Number(results[1].value)||0;
   }
  }catch{console.error("Reminder push processing unavailable")}
  const {error:finish}=await admin.rpc("finish_scheduled_booking_reminder",{p_booking:row.booking_id,p_stage:row.stage,p_email:email,p_web:web,p_android:android});
  if(finish)console.error("Reminder result recording unavailable");
 }));
 return Response.json({ok:true,processed:rows?.length??0},{headers:{"Cache-Control":"no-store"}});
});