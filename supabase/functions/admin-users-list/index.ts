import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const origins = new Set([
  "https://sathivo.co",
  "https://www.sathivo.co",
  "https://app.sathivo.co",
  "https://milanmiliyan5.github.io"
]);
function isAllowed(origin: string) {
  return origins.has(origin) || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
}
function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origin && isAllowed(origin) ? origin : "https://sathivo.co",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}
function anonKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try { const keys = JSON.parse(raw); if (keys.default) return keys.default; } catch {}
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}
function adminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try { const keys = JSON.parse(raw); if (keys.default) return keys.default; } catch {}
  }
  return "";
}
function errorResponse(message: string, status: number, req: Request) {
  return Response.json({ error: message }, { status, headers: cors(req) });
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  if (origin && !isAllowed(origin)) return errorResponse("Origin not allowed", 403, req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405, req);

  try {
    const bearer = req.headers.get("Authorization") ?? "";
    const token = bearer.replace(/^Bearer\s+/i, "");
    if (!token || token === bearer) return errorResponse("Sign in required", 401, req);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const publicKey = anonKey(), secretKey = adminKey();
    if (!url || !publicKey || !secretKey) throw new Error("Supabase keys unavailable");

    const caller = createClient(url, publicKey, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userError } = await caller.auth.getUser(token);
    if (userError || !userData.user) return errorResponse("Invalid session", 401, req);
    const { data: role, error: roleError } = await caller.from("platform_admins")
      .select("role").eq("user_id", userData.user.id).maybeSingle();
    if (roleError || !role) return errorResponse("Admin access required", 403, req);

    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // The Postgres function returns signup-only accounts and completed profiles together.
    // EXECUTE is revoked from anon/authenticated; only this authorized server-side client may call it.
    const { data: users, error: listError } = await admin.rpc("admin_list_all_signups_server_v1");
    if (listError) throw listError;
    if (!Array.isArray(users)) throw new Error("Invalid users result");
    return Response.json({ users }, { headers: cors(req) });
  } catch (err) {
    console.error("admin-users-list:", JSON.stringify({ message: (err as Error)?.message ?? String(err), code: (err as {code?:string})?.code, status: (err as {status?:number})?.status }));
    return errorResponse("Could not load registered users", 500, req);
  }
});