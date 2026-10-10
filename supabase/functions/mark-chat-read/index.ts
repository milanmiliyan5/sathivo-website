import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const allowedOrigins = new Set([
  "https://sathivo.co",
  "https://www.sathivo.co",
  "https://app.sathivo.co",
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
  if(raw){try{const p=JSON.parse(raw);if(p.default)return p.default}catch{}}
  return Deno.env.get("SUPABASE_ANON_KEY")??"";
}
function serverKey(){
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;
  const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(raw){try{const p=JSON.parse(raw);if(p.default)return p.default}catch{}}
  return "";
}
Deno.serve(async req=>{
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
    const {data:ud,error:ue}=await userClient.auth.getUser(token);
    const user=ud.user;if(ue||!user)return Response.json({error:"Invalid session"},{status:401,headers: corsHeaders(req)});

    const body=await req.json();
    const bookingId=String(body?.booking_id??"");
    const seen=body?.seen===true;
    if(!/^[0-9a-f-]{36}$/i.test(bookingId))return Response.json({error:"Invalid booking"},{status:400,headers: corsHeaders(req)});

    const {data:b,error:be}=await userClient.from("booking_requests")
      .select("id,customer_id,companion_id")
      .eq("id",bookingId).maybeSingle();
    if(be||!b)return Response.json({error:"Booking unavailable"},{status:404,headers: corsHeaders(req)});
    if(user.id!==b.customer_id&&user.id!==b.companion_id)
      return Response.json({error:"Not a booking participant"},{status:403,headers: corsHeaders(req)});

    const key=serverKey();if(!key)throw new Error("Server key unavailable");
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const now=new Date().toISOString();

    const {error:de}=await admin.from("booking_messages")
      .update({delivered_at:now})
      .eq("booking_id",bookingId)
      .neq("sender_id",user.id)
      .is("delivered_at",null);
    if(de)throw de;

    if(seen){
      const {error:se}=await admin.from("booking_messages")
        .update({delivered_at:now,seen_at:now})
        .eq("booking_id",bookingId)
        .neq("sender_id",user.id)
        .is("seen_at",null);
      if(se)throw se;
    }

    return Response.json({ok:true,seen},{headers:{...corsHeaders(req),"Content-Type":"application/json"}});
  }catch(error){
    console.error(error);
    return Response.json({error:error instanceof Error?error.message:"Unexpected error"},{status:500,headers: corsHeaders(req)});
  }
});
