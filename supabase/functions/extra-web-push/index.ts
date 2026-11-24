import {createClient} from "npm:@supabase/supabase-js@2.116.0";
import webpush from "npm:web-push@3.6.7";
function serviceKey(){const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}").default??""}catch{return ""}}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
 const token=req.headers.get("x-sathivo-scheduler")??"";
 if(!/^[0-9a-f-]{72}$/i.test(token))return Response.json({error:"Unauthorized"},{status:401});
 const key=serviceKey();if(!key)return Response.json({error:"Unavailable"},{status:503});
 const admin=createClient(Deno.env.get("SUPABASE_URL")??"",key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:authorized,error:ae}=await admin.rpc("authorize_extra_web_push",{p_token:token});
 if(ae||authorized!==true)return Response.json({error:"Unauthorized"},{status:401});
 const {data:config,error:ce}=await admin.rpc("get_vapid_config_server");
 const keys=Array.isArray(config)?config[0]:config;
 if(ce||!keys?.public_key||!keys?.private_key)return Response.json({error:"Unavailable"},{status:503});
 webpush.setVapidDetails("mailto:no-reply@auth.sathivo.co",keys.public_key,keys.private_key);
 const {data:rows,error}=await admin.rpc("claim_extra_web_push",{p_token:token});
 if(error)return Response.json({error:"Unavailable"},{status:503});
 let accepted=0;
 await Promise.all((rows??[]).map(async(row:any)=>{
  let sent=0,failed=0;
  try{
   const {data:allowed,error:check}=await admin.rpc("extra_web_push_still_valid",{p_id:row.id});
   if(check||allowed!==true)throw Error("Event no longer eligible");
   const {data:subs,error:se}=await admin.from("push_subscriptions").select("endpoint,p256dh,auth_key").eq("user_id",row.target_user_id).limit(20);
   if(se)throw Error("Subscription lookup failed");
   await Promise.all((subs??[]).map(async(s:any)=>{
    try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth_key}},JSON.stringify({title:row.title,body:row.body,url:row.url,tag:"sathivo-extra-"+row.id}),{TTL:row.kind==="meeting"?300:3600,urgency:"normal",timeout:8000});sent++}
    catch(e:any){failed++;if([404,410].includes(Number(e?.statusCode)))await admin.from("push_subscriptions").delete().eq("endpoint",s.endpoint).eq("user_id",row.target_user_id)}
   }));
  }catch{failed++}
  accepted+=sent;
  await admin.rpc("finish_extra_web_push",{p_id:row.id,p_sent:sent,p_failed:failed});
 }));
 return Response.json({ok:true,processed:rows?.length??0,provider_accepted:accepted},{headers:{"Cache-Control":"no-store"}});
});