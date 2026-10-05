import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function publishableKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.default) return parsed.default;
    } catch {}
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function serverKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.default) return parsed.default;
    } catch {}
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Sign in required" }, { status: 401, headers: corsHeaders });

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const userClient = createClient(url, publishableKey(), {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders });

    const key = serverKey();
    if (!key) throw new Error("Server key unavailable");
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = await req.json();
    const action = body?.action;

    if (action === "register") {
      const sub = body?.subscription;
      const endpoint = String(sub?.endpoint ?? "");
      const p256dh = String(sub?.keys?.p256dh ?? "");
      const authKey = String(sub?.keys?.auth ?? "");
      if (!endpoint.startsWith("https://") || endpoint.length > 4096 || p256dh.length < 20 || authKey.length < 8) {
        return Response.json({ error: "Invalid push subscription" }, { status: 400, headers: corsHeaders });
      }

      const { error } = await admin.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint,
        p256dh,
        auth_key: authKey,
        user_agent: String(body?.user_agent ?? "").slice(0, 500),
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;

      return Response.json({ ok: true }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "unregister") {
      const endpoint = String(body?.endpoint ?? "");
      if (endpoint) {
        const { error } = await admin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
        if (error) throw error;
      }
      return Response.json({ ok: true }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500, headers: corsHeaders });
  }
});
