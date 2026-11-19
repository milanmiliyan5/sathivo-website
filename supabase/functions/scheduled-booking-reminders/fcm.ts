let cached: {token:string;expires:number}|undefined;
const enc=new TextEncoder();
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");}
export async function accessToken(){
 if(cached&&cached.expires>Date.now()+60000)return cached.token;
 const cfg=JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")??"{}");
 if(cfg.project_id!=="sathivo"||cfg.client_email!=="sathivo-fcm@sathivo.iam.gserviceaccount.com"||typeof cfg.private_key!=="string")throw Error("FCM configuration unavailable");
 const now=Math.floor(Date.now()/1000);
 const assertion=b64(enc.encode(JSON.stringify({alg:"RS256",typ:"JWT"})))+"."+b64(enc.encode(JSON.stringify({iss:cfg.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})));
 const der=Uint8Array.from(atob(cfg.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"")),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",der,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,enc.encode(assertion));
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:assertion+"."+b64(new Uint8Array(signature))}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("FCM authentication failed");
 const data=await response.json();
 if(typeof data.access_token!=="string")throw Error("FCM authorization unavailable");
 cached={token:data.access_token,expires:Date.now()+Number(data.expires_in||3600)*1000};return cached.token;
}
export async function sendAndroid(token:string,{test=false}={}) {
 const bearer=await accessToken();
 const response=await fetch("https://fcm.googleapis.com/v1/projects/sathivo/messages:send",{method:"POST",headers:{Authorization:"Bearer "+bearer,"Content-Type":"application/json"},body:JSON.stringify({message:{token,notification:{title:test?"Sathivo test notification":"Sathivo",body:test?"Your phone notification test arrived.":"You have a new Sathivo update. Open the app to view it."},data:{destination:"notifications"},android:{priority:"HIGH",ttl:"300s",notification:{channel_id:"sathivo_updates",visibility:"PRIVATE",tag:test?"sathivo-test":"sathivo-update",sound:"default"}}}}),signal:AbortSignal.timeout(10000)});
 if(response.ok)return "sent";
 const error=await response.json().catch(()=>({}));
 if(error?.error?.details?.some((d:{errorCode?:string})=>d.errorCode==="UNREGISTERED"))return "unregistered";
 console.error("FCM send failed",response.status);
 return "failed";
}
export async function deliverAndroid(admin:any,userId:string){
 const {data,error}=await admin.from("android_push_devices").select("token").eq("user_id",userId).gt("updated_at",new Date(Date.now()-60*86400000).toISOString()).limit(20);
 if(error)throw Error("Device lookup failed");
 let sent=0;
 await Promise.all((data??[]).map(async(row:{token:string})=>{
  try{const result=await sendAndroid(row.token);if(result==="sent")sent++;if(result==="unregistered")await admin.from("android_push_devices").delete().eq("token",row.token).eq("user_id",userId);}
  catch{console.error("Android delivery unavailable");}
 }));
 return sent;
}