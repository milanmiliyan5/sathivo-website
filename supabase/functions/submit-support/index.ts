import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const allowedOrigins = new Set([
  "https://sathivo.co",
  "https://www.sathivo.co",
  "https://app.sathivo.co",
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

function publishableKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try { const parsed = JSON.parse(raw); if (parsed.default) return parsed.default; } catch {}
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function serverKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try { const parsed = JSON.parse(raw); if (parsed.default) return parsed.default; } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
    admin.rpc("consume_edge_rate_limit_server",{p_scope:"support-hour",p_key_hash:keyHash,p_window_seconds:3600,p_limit:12}),
    admin.rpc("consume_edge_rate_limit_server",{p_scope:"support-day",p_key_hash:keyHash,p_window_seconds:86400,p_limit:40}),
  ]);
  if(hour.error)throw hour.error;if(day.error)throw day.error;
  return hour.data===true&&day.data===true;
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowed = new Set(["account","privacy","safety","technical","feedback","other"]);

Deno.serve(async (req) => {
  const headers=corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  const origin=req.headers.get("origin")??"";
  if(origin&&!originAllowed(origin))return Response.json({error:"Origin not allowed"},{status:403,headers});

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = serverKey();
    if (!url || !key) throw new Error("Server configuration unavailable");
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const fingerprint=await requestFingerprint(req,key);
    if(!await withinLimits(admin,fingerprint)){
      return Response.json({error:"Too many requests. Please wait and try again later."},{status:429,headers});
    }

    const body = await req.json();
    if (String(body?.website ?? "").trim()) {
      return Response.json({ ok: true }, { headers: { ...headers, "Content-Type": "application/json" } });
    }

    const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 254);
    const category = String(body?.category ?? "").trim();
    const subject = String(body?.subject ?? "").trim();
    const message = String(body?.message ?? "").trim();
    const ratingValue = Number(body?.rating ?? 0);
    const rating = Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null;
    const feedbackType = String(body?.feedback_type ?? "").trim();
    const allowedFeedbackTypes = new Set(["suggestion","bug","experience","compliment","other"]);

    if (!emailRe.test(email)) return Response.json({ error: "Enter a valid email address" }, { status: 400, headers });
    if (!allowed.has(category)) return Response.json({ error: "Choose a valid support category" }, { status: 400, headers });
    if (subject.length < 3 || subject.length > 120) return Response.json({ error: "Subject must be 3–120 characters" }, { status: 400, headers });
    if (message.length < 10 || message.length > 3000) return Response.json({ error: "Message must be 10–3000 characters" }, { status: 400, headers });
    if (category === "feedback" && body?.rating !== undefined && rating === null) return Response.json({ error: "Choose a rating from 1 to 5" }, { status: 400, headers });
    if (category === "feedback" && feedbackType && !allowedFeedbackTypes.has(feedbackType)) return Response.json({ error: "Choose a valid feedback type" }, { status: 400, headers });

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= 5) return Response.json({ error: "Too many requests from this email. Please try again later." }, { status: 429, headers });

    let userId = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token.split(".").length === 3) {
      const userClient = createClient(url, publishableKey(), {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await userClient.auth.getUser(token);
      if (data.user && data.user.email?.toLowerCase() === email) userId = data.user.id;
    }

    const { data, error } = await admin
      .from("support_requests")
      .insert({ user_id: userId, email, category, subject, message, rating: category === "feedback" ? rating : null, feedback_type: category === "feedback" && feedbackType ? feedbackType : null })
      .select("id")
      .single();
    if (error) throw error;

    return Response.json(
      { ok: true, case_id: data.id },
      { headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("support_submit_failed");
    return Response.json({ error: "Could not send your request. Please try again." }, { status: 500, headers });
  }
});
