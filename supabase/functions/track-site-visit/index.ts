import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers:corsHeaders});
  try{
    const body=await req.json();
    const visitorId=String(body?.visitor_id??"").trim();
    let page=String(body?.page??"").trim().slice(0,120);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId))
      return Response.json({error:"Invalid visitor id"},{status:400,headers:corsHeaders});
    if(!page||!/^[a-z0-9._\/-]+$/i.test(page))page="unknown";

    const url=Deno.env.get("SUPABASE_URL")??"",key=serverKey();
    if(!url||!key)throw new Error("Server configuration unavailable");
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const visitorHash=await sha256(visitorId),now=new Date().toISOString(),date=indiaDate();

    const [allTime,daily]=await Promise.all([
      admin.from("site_visitors").upsert({visitor_hash:visitorHash,last_seen:now,last_page:page},{onConflict:"visitor_hash"}),
      admin.from("site_daily_visitors").upsert({visit_date:date,visitor_hash:visitorHash,last_seen:now,last_page:page},{onConflict:"visit_date,visitor_hash"})
    ]);
    if(allTime.error)throw allTime.error;if(daily.error)throw daily.error;
    return Response.json({ok:true},{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(error){
    console.error(error instanceof Error?error.message:JSON.stringify(error));
    return Response.json({error:"Could not record visit"},{status:500,headers:corsHeaders});
  }
});
