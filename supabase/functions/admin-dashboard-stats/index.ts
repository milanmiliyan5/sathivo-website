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

function publishableKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try { const parsed = JSON.parse(raw); if (parsed.default) return parsed.default; } catch {}
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
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

Deno.serve(async (req) => {
  const origin=req.headers.get("origin")??"";
  if(origin && !originAllowed(origin)){
    return Response.json({error:"Origin not allowed"},{status:403,headers:corsHeaders(req)});
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders(req) });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Sign in required" }, { status: 401, headers: corsHeaders(req) });

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const userClient = createClient(url, publishableKey(), {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders(req) });

    const { data: adminRow, error: adminError } = await userClient
      .from("platform_admins").select("role").eq("user_id", user.id).maybeSingle();
    if (adminError || !adminRow) return Response.json({ error: "Admin access required" }, { status: 403, headers: corsHeaders(req) });

    const key = serverKey();
    if (!key) throw new Error("Server key unavailable");
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data, error } = await admin.rpc("admin_dashboard_stats_server_v3");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;

    return Response.json(row ?? {}, { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  } catch (error) {
    console.error(error instanceof Error ? error.message : JSON.stringify(error));
    return Response.json({ error: "Could not load admin statistics" }, { status: 500, headers: corsHeaders(req) });
  }
});
