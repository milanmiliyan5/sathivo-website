import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const allowedOrigins = new Set([
  "https://sathivo.co",
  "https://www.sathivo.co",
  "https://milanmiliyan5.github.io",
]);
function originAllowed(origin:string){
  return allowedOrigins.has(origin) || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
}
function corsHeaders(req:Request){
  const origin=req.headers.get("origin")??"";
  return {
    "Access-Control-Allow-Origin": originAllowed(origin) ? origin : "https://sathivo.co",
    "Vary":"Origin",
    "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
  };
}
function serverKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try { const parsed = JSON.parse(raw); if (parsed.default) return parsed.default; } catch {}
  }
  return "";
}
function indiaDate() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type,p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
async function sha256(value:string) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function requestFingerprint(req:Request,key:string){
  const ip=(req.headers.get("x-forwarded-for")??req.headers.get("cf-connecting-ip")??req.headers.get("x-real-ip")??"unknown").split(",")[0].trim().slice(0,96);
  const ua=(req.headers.get("user-agent")??"unknown").slice(0,300);
  const lang=(req.headers.get("accept-language")??"").slice(0,120);
  const material=new TextEncoder().encode(ip+"|"+ua+"|"+lang);
  const cryptoKey=await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",cryptoKey,material);
  return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function withinLimits(admin:any,keyHash:string){
  const [hour,day]=await Promise.all([
    admin.rpc("consume_edge_rate_limit_server",{p_scope:"site-visit-hour",p_key_hash:keyHash,p_window_seconds:3600,p_limit:200}),
    admin.rpc("consume_edge_rate_limit_server",{p_scope:"site-visit-day",p_key_hash:keyHash,p_window_seconds:86400,p_limit:2000}),
  ]);
  if(hour.error)throw hour.error;if(day.error)throw day.error;
  return hour.data===true&&day.data===true;
}

Deno.serve(async req=>{
  const headers=corsHeaders(req);
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers});
  const origin=req.headers.get("origin")??"";
  if(origin&&!originAllowed(origin))return Response.json({error:"Origin not allowed"},{status:403,headers});
  try{
    const body=await req.json();
    const visitorId=String(body?.visitor_id??"").trim();
    let page=String(body?.page??"").trim().slice(0,120);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId))
      return Response.json({error:"Invalid visitor id"},{status:400,headers});
    if(!page||!/^[a-z0-9._\/-]+$/i.test(page))page="unknown";

    const url=Deno.env.get("SUPABASE_URL")??"",key=serverKey();
    if(!url||!key)throw new Error("Server configuration unavailable");
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const fingerprint=await requestFingerprint(req,key);
    if(!await withinLimits(admin,fingerprint)){
      return Response.json({ok:true,throttled:true},{headers:{...headers,"Content-Type":"application/json","Cache-Control":"no-store"}});
    }

    const visitorHash=await sha256(visitorId),now=new Date().toISOString(),date=indiaDate();

    const [allTime,daily]=await Promise.all([
      admin.from("site_visitors").upsert({visitor_hash:visitorHash,last_seen:now,last_page:page},{onConflict:"visitor_hash"}),
      admin.from("site_daily_visitors").upsert({visit_date:date,visitor_hash:visitorHash,last_seen:now,last_page:page},{onConflict:"visit_date,visitor_hash"})
    ]);
    if(allTime.error)throw allTime.error;if(daily.error)throw daily.error;
    return Response.json({ok:true},{headers:{...headers,"Content-Type":"application/json","Cache-Control":"no-store"}});
  }catch(error){
    console.error(error instanceof Error?error.message:JSON.stringify(error));
    return Response.json({error:"Could not record visit"},{status:500,headers});
  }
});
