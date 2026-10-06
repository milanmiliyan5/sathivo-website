import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const allowedOrigins = new Set([
  "https://sathivo.co",
  "https://www.sathivo.co",
  "https://milanmiliyan5.github.io",
]);
function originAllowed(origin:string){
  return allowedOrigins.has(origin) || /^http:\/\/(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?$/.test(origin);
}
function corsHeaders(req:Request){
  const origin=req.headers.get("origin")??"";
  return {
    "Access-Control-Allow-Origin": originAllowed(origin) ? origin : "https://sathivo.co",
    "Vary":"Origin",
    "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
  };
}

function publishableKey(){
  const raw=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if(raw){try{const parsed=JSON.parse(raw);if(parsed.default)return parsed.default}catch{}}
  return Deno.env.get("SUPABASE_ANON_KEY")??"";
}
function serverKey(){
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(legacy)return legacy;
  const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(raw){try{const parsed=JSON.parse(raw);if(parsed.default)return parsed.default}catch{}}
  return "";
}

Deno.serve(async(req)=>{
  const origin=req.headers.get("origin")??"";
  if(origin && !originAllowed(origin)){
    return Response.json({error:"Origin not allowed"},{status:403,headers:corsHeaders(req)});
  }
  if(req.method==="OPTIONS")return new Response("ok",{headers: corsHeaders(req)});
  if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers: corsHeaders(req)});
  try{
    const authHeader=req.headers.get("Authorization")??"";
    const token=authHeader.replace(/^Bearer\s+/i,"");
    if(!token)return Response.json({error:"Sign in required"},{status:401,headers: corsHeaders(req)});

    const url=Deno.env.get("SUPABASE_URL")??"";
    const userClient=createClient(url,publishableKey(),{
      global:{headers:{Authorization:authHeader}},
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const {data:userData,error:userError}=await userClient.auth.getUser(token);
    const user=userData.user;
    if(userError||!user)return Response.json({error:"Invalid session"},{status:401,headers: corsHeaders(req)});

    const body=await req.json();
    const messageId=String(body?.message_id??"");
    if(!/^[0-9a-f-]{36}$/i.test(messageId))return Response.json({error:"Invalid message"},{status:400,headers: corsHeaders(req)});

    const {data:message,error:messageError}=await userClient
      .from("booking_messages")
      .select("id,booking_id,sender_id,message_type,photo_path,view_once,viewed_at")
      .eq("id",messageId)
      .maybeSingle();

    if(messageError||!message)return Response.json({error:"Photo unavailable"},{status:404,headers: corsHeaders(req)});
    if(message.message_type!=="image"||!message.view_once||!message.photo_path)
      return Response.json({error:"This is not a view-once photo"},{status:400,headers: corsHeaders(req)});
    if(message.sender_id===user.id)
      return Response.json({error:"Sender preview does not consume view-once media"},{status:400,headers: corsHeaders(req)});
    if(message.viewed_at)
      return Response.json({error:"This view-once photo has already been opened"},{status:410,headers: corsHeaders(req)});

    const key=serverKey();
    if(!key)throw new Error("Server key unavailable");
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

    const {data:consumed,error:consumeError}=await admin
      .from("booking_messages")
      .update({viewed_at:new Date().toISOString(),viewed_by:user.id})
      .eq("id",messageId)
      .eq("view_once",true)
      .is("viewed_at",null)
      .neq("sender_id",user.id)
      .select("photo_path")
      .maybeSingle();

    if(consumeError)throw consumeError;
    if(!consumed?.photo_path)
      return Response.json({error:"This view-once photo has already been opened"},{status:410,headers: corsHeaders(req)});

    const {data:signed,error:signError}=await admin.storage
      .from("booking-chat-photos")
      .createSignedUrl(consumed.photo_path,30);

    if(signError||!signed?.signedUrl)throw signError??new Error("Could not open photo");

    return Response.json({ok:true,signed_url:signed.signedUrl,expires_in:30},{
      headers:{...corsHeaders(req),"Content-Type":"application/json","Cache-Control":"no-store"},
    });
  }catch(error){
    console.error(error);
    return Response.json({error:error instanceof Error?error.message:"Unexpected error"},{status:500,headers: corsHeaders(req)});
  }
});
