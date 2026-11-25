// Booking emails are intentionally disabled. Legacy web and Android calls remain compatible.
// Authentication emails are handled separately by Supabase Auth.
const origins=new Set(["https://sathivo.co","https://www.sathivo.co","https://app.sathivo.co","https://milanmiliyan5.github.io"]);
function allowed(origin:string){return origins.has(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)}
Deno.serve((req:Request)=>{
 const origin=req.headers.get("origin")??"";
 const headers={"Access-Control-Allow-Origin":origin&&allowed(origin)?origin:"https://sathivo.co","Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
 if(origin&&!allowed(origin))return Response.json({error:"Origin not allowed"},{status:403,headers});
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers});
 return Response.json({ok:true,sent:0,submitted:false,skipped:"booking_email_disabled"},{headers});
});