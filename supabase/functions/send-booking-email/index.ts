const EMAIL_SIGNATURE = "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-collapse:collapse;margin-top:18px;border-top:1px solid #eadce5;font-family:Arial,Helvetica,sans-serif;color:#33242d\"><tr><td style=\"padding:12px 10px 0 0;vertical-align:middle\"><a href=\"https://sathivo.co/\" style=\"text-decoration:none\"><img src=\"https://sathivo.co/assets/sathivo-email-logo.png\" alt=\"Sathivo\" width=\"44\" height=\"44\" style=\"display:block;width:44px;height:44px;border:0;border-radius:8px\"></a></td><td style=\"padding:12px 0 0;vertical-align:middle\"><div style=\"font-size:14px;font-weight:bold;line-height:19px;color:#8e3655\">Team Sathivo</div><div style=\"font-size:11px;line-height:16px;color:#685765\">Real Company. Real Moments.</div><a href=\"https://sathivo.co/\" style=\"font-size:11px;line-height:16px;color:#8e3655;text-decoration:underline\">sathivo.co</a></td></tr></table>";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const origins=new Set(["https://sathivo.co","https://www.sathivo.co","https://app.sathivo.co","https://milanmiliyan5.github.io"]);
function allowed(origin:string){return origins.has(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)}
function headers(req:Request){
 const origin=req.headers.get("origin")??"";
 return {"Access-Control-Allow-Origin":origin&&allowed(origin)?origin:"https://sathivo.co","Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
}
function publicKey(){
 const raw=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
 if(raw){try{const j=JSON.parse(raw);if(j.default)return j.default}catch{}}
 return Deno.env.get("SUPABASE_ANON_KEY")??"";
}
function serviceKey(){
 const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(legacy)return legacy;
 const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
 if(raw){try{const j=JSON.parse(raw);if(j.default)return j.default}catch{}}
 return "";
}
function fail(req:Request,error:string,status:number){return Response.json({error},{status,headers:headers(req)})}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function message(event:string,bookingId:string){
 const link=event==="request"
   ?"https://sathivo.co/requests.html?id="+bookingId
   :"https://sathivo.co/chat.html?booking="+bookingId;
 if(event==="request")return {
  subject:"A new booking request is waiting on Sathivo 💌",
  title:"You’ve received a booking request!",
  greeting:"Someone would like to book you on Sathivo.",
  body:"Open your requests to see the activity, time and hourly offer. You can accept or decline when you’re ready.",
  action:"View booking request",link
 };
 return {
  subject:"Your Sathivo booking was accepted! 🎉",
  title:"Good news! Your request was accepted.",
  greeting:"Your companion has accepted your booking request on Sathivo.",
  body:"Your private booking chat is now available. Sign in with the SAME Sathivo account you used to book, then confirm the plan and boundaries together.",
  action:"Open private chat",link
 };
}
function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"} as Record<string,string>)[c])}
function template(m:ReturnType<typeof message>){
 return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body style=\"margin:0;background:#fff6fb;font-family:Arial,sans-serif;color:#26152e\"><div style=\"max-width:540px;margin:26px auto;background:#fff;border:1px solid #f4d7eb;border-radius:20px;padding:30px\"><div style=\"color:#c21c88;font-size:26px;font-weight:800\">♡ Sathivo</div><p style=\"color:#755671;font-size:12px;letter-spacing:1px\">REAL COMPANY. REAL MOMENTS.</p><h1 style=\"font-size:25px;line-height:1.25\">"+escapeHtml(m.title)+"</h1><p style=\"font-size:15px;line-height:1.7\">"+escapeHtml(m.greeting)+"</p><p style=\"font-size:15px;line-height:1.7\">"+escapeHtml(m.body)+"</p><p style=\"padding:12px 0\"><a href=\""+escapeHtml(m.link)+"\" style=\"background:linear-gradient(90deg,#ec268a,#8726d7);color:#fff;text-decoration:none;border-radius:13px;display:inline-block;padding:14px 24px;font-weight:700\">"+escapeHtml(m.action)+" →</a></p><p style=\"font-size:13px;line-height:1.65;color:#725d70\">This link only opens details for the correct signed-in booking participant. Sathivo never asks for your password or OTP by email.</p><hr style=\"border:0;border-top:1px solid #f2deeb\"><p style=\"font-size:12px;color:#80677c\">Sathivo · 18+ · Strictly platonic<br>https://sathivo.co</p>"+EMAIL_SIGNATURE+"</div></body></html>";
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:headers(req)});
 if(req.method!=="POST")return fail(req,"Method not allowed",405);
 const origin=req.headers.get("origin")??"";
 if(origin&&!allowed(origin))return fail(req,"Origin not allowed",403);
 let ledgerId:string|undefined;
 let ledgerEvent:string|undefined;
 let admin:any;
 try{
  const h=req.headers.get("Authorization")??"";
  const token=h.replace(/^Bearer\s+/i,"");
  if(!token||token===h)return fail(req,"Sign in required",401);
  const url=Deno.env.get("SUPABASE_URL")??"";
  const pub=publicKey(),priv=serviceKey();
  if(!url||!pub||!priv)throw Error("Missing Supabase configuration");
  const client=createClient(url,pub,{global:{headers:{Authorization:h}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await client.auth.getUser(token);
  const actor=auth?.user;
  if(authError||!actor)return fail(req,"Session expired",401);

  const body=await req.json().catch(()=>null);
  const id=String(body?.booking_id??"");
  const event=String(body?.event??"");
  if(!uuid.test(id)||!["request","accepted"].includes(event))return fail(req,"Invalid event",400);
  const {data:b,error:bookingError}=await client.from("booking_requests").select("id,customer_id,companion_id,status").eq("id",id).single();
  if(bookingError||!b)return fail(req,"Booking unavailable",404);
  if(event==="request"&&(b.customer_id!==actor.id||b.status!=="pending"))return fail(req,"Request event not permitted",403);
  if(event==="accepted"&&(b.companion_id!==actor.id||b.status!=="accepted"))return fail(req,"Acceptance event not permitted",403);
  const recipient=event==="request"?b.companion_id:b.customer_id;

  const resendKey=Deno.env.get("RESEND_API_KEY")??"";
  if(!resendKey)return fail(req,"Email service is not yet configured",503);
  admin=createClient(url,priv,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:recipientData,error:recipientError}=await admin.auth.admin.getUserById(recipient);
  if(recipientError||!recipientData?.user)throw Error("Recipient lookup failed");
  const to=recipientData.user.email;
  if(!to||!recipientData.user.email_confirmed_at)return Response.json({ok:true,skipped:"email_not_verified"},{headers:headers(req)});

  const {error:lockError}=await admin.from("booking_email_delivery_events").insert({
   booking_id:id,event,target_user_id:recipient
  });
  if(lockError){
   if(lockError.code==="23505")return Response.json({ok:true,already_queued:true},{headers:headers(req)});
   throw lockError;
  }
  ledgerId=id;ledgerEvent=event;
  const m=message(event,id);
  const from=Deno.env.get("BOOKING_EMAIL_FROM")||"Sathivo <no-reply@auth.sathivo.co>";
  const sent=await fetch("https://api.resend.com/emails",{
   method:"POST",
   headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json","Idempotency-Key":"sathivo-"+event+"-"+id},
   body:JSON.stringify({from,to:[to],subject:m.subject,html:template(m),text:m.title+"\n\n"+m.greeting+"\n\n"+m.body+"\n\n"+m.action+": "+m.link+"\n\nSathivo · 18+ · Strictly platonic"})
  });
  if(!sent.ok){
   console.error("booking-email-provider-error",sent.status);
   throw Error("Email provider rejected delivery");
  }
  const delivery=await sent.json().catch(()=>({}));
  const {error:updateError}=await admin.from("booking_email_delivery_events").update({
   provider_message_id:typeof delivery.id==="string"?delivery.id:null,
   sent_at:new Date().toISOString()
  }).eq("booking_id",id).eq("event",event);
  if(updateError)console.error("booking-email-ledger-update-failed",updateError.code);
  return Response.json({ok:true,submitted:true},{headers:headers(req)});
 }catch(e){
  if(ledgerId&&ledgerEvent&&admin){
   // On failed provider requests allow a safe later retry of this event.
   try{await admin.from("booking_email_delivery_events").delete().eq("booking_id",ledgerId).eq("event",ledgerEvent).is("sent_at",null)}catch{}
  }
  console.error("booking-email-failed",e instanceof Error?e.message:"Unknown");
  return fail(req,"Could not send booking email",500);
 }
});