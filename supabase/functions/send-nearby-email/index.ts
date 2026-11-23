// Nearby discovery is now in-app + browser push only.
// Do not send nearby email; preserve booking, security and OTP email services.
const allowed=new Set(["https://sathivo.co","https://www.sathivo.co","https://app.sathivo.co","https://milanmiliyan5.github.io"]);
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  const headers={
    "Access-Control-Allow-Origin":allowed.has(origin)?origin:"https://sathivo.co",
    "Vary":"Origin",
    "Access-Control-Allow-Methods":"POST,OPTIONS",
    "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
    "Content-Type":"application/json"
  };
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers});
  return Response.json({ok:true,sent:0,reason:"nearby_email_disabled"},{headers});
});