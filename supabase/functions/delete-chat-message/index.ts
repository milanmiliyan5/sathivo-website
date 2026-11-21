import { createClient } from "npm:@supabase/supabase-js@2.116.0";

// Only the authenticated booking participants may act on booking messages.
// The database RPC re-checks sender / participant permissions transactionally.
const allowedOrigins=new Set([
  "https://sathivo.co",
  "https://www.sathivo.co",
  "https://app.sathivo.co",
  "https://milanmiliyan5.github.io",
]);
function allowedOrigin(origin:string){
  return !origin||allowedOrigins.has(origin)||/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
}
function cors(req:Request){
  const origin=req.headers.get("origin")??"";
  return {
    "Access-Control-Allow-Origin":origin&&allowedOrigin(origin)?origin:"https://sathivo.co",
    "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Vary":"Origin",
    "Cache-Control":"no-store",
  };
}
function json(req:Request,body:Record<string,unknown>,status=200){
  return Response.json(body,{status,headers:{...cors(req),"Content-Type":"application/json"}});
}
function publicKey(){
  const raw=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if(raw){try{const value=JSON.parse(raw);if(value.default)return value.default}catch{}}
  return Deno.env.get("SUPABASE_ANON_KEY")??"";
}
function privateKey(){
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;
  const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(raw){try{const value=JSON.parse(raw);if(value.default)return value.default}catch{}}
  return "";
}
type CleanupRow={message_id:string,photo_path:string,attempts:number};
async function cleanupQueuedPhotos(url:string,key:string){
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:pending,error:readError}=await admin
    .from("booking_media_cleanup_queue")
    .select("message_id,photo_path,attempts")
    .order("queued_at",{ascending:true})
    .limit(3);
  if(readError)throw readError;
  for(const row of (pending??[]) as CleanupRow[]){
    try{
      const {error:removeError}=await admin.storage.from("booking-chat-photos").remove([row.photo_path]);
      if(removeError)throw removeError;
      const {error:doneError}=await admin.from("booking_media_cleanup_queue")
        .delete().eq("message_id",row.message_id);
      if(doneError)throw doneError;
    }catch(error){
      const detail=error instanceof Error?error.message:"Storage cleanup error";
      console.warn("Deferred private-photo cleanup:",row.message_id,detail.slice(0,130));
      await admin.from("booking_media_cleanup_queue")
        .update({attempts:row.attempts+1,last_error:detail.slice(0,200)})
        .eq("message_id",row.message_id);
    }
  }
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(!allowedOrigin(req.headers.get("origin")??""))return json(req,{error:"Origin not allowed"},403);
  if(req.method!=="POST")return json(req,{error:"Method not allowed"},405);
  const authHeader=req.headers.get("Authorization")??"";
  const token=authHeader.replace(/^Bearer\s+/i,"").trim();
  if(!token||token===authHeader)return json(req,{error:"Sign in required"},401);

  let payload:unknown;
  try{payload=await req.json()}catch{return json(req,{error:"Invalid request body"},400)}
  const {message_id,scope}=(payload??{}) as Record<string,unknown>;
  if(typeof message_id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(message_id)
      ||(scope!=="me"&&scope!=="everyone")){
    return json(req,{error:"Invalid message or action"},400);
  }

  try{
    const url=Deno.env.get("SUPABASE_URL")??"";
    const key=publicKey();
    if(!url||!key)throw Error("Chat service configuration unavailable");
    const caller=createClient(url,key,{
      global:{headers:{Authorization:authHeader}},
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const {data:identity,error:identityError}=await caller.auth.getUser(token);
    if(identityError||!identity.user)return json(req,{error:"Sign in required"},401);

    const {data:result,error:deleteError}=await caller.rpc("delete_booking_message",{
      p_message_id:message_id,p_scope:scope,
    });
    if(deleteError){
      const code=deleteError.code??"";
      const status=code==="42501"?403:code==="P0002"?404:code==="22023"?400:500;
      if(status===500)console.error("Chat deletion RPC failed:",code);
      return json(req,{error:status===403?"Not allowed to delete this message":status===404?"Message unavailable":status===400?"Invalid action":"Could not delete message"},status);
    }

    if(scope==="everyone"){
      // The RPC has already removed the photo reference from live messages.
      // Retry queued storage deletion using service-role privileges only.
      const secret=privateKey();
      if(secret){
        try{await cleanupQueuedPhotos(url,secret)}
        catch(error){console.warn("Photo cleanup deferred:",error instanceof Error?error.message:"Unknown issue")}
      }else{
        console.warn("Photo cleanup deferred: service credential unavailable");
      }
    }

    return json(req,{ok:true,scope,already_deleted:result?.already_deleted===true});
  }catch(error){
    console.error("Chat deletion unavailable:",error instanceof Error?error.message:"Unexpected error");
    return json(req,{error:"Chat service temporarily unavailable. Try again."},503);
  }
});
