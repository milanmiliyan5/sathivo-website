import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const allowedOrigins = new Set([
  "https://sathivo.co",
  "https://www.sathivo.co",
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
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try { const parsed = JSON.parse(raw); if (parsed.default) return parsed.default; } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

async function removeBookingMedia(admin, bookingId) {
  const bucket = admin.storage.from("booking-chat-photos");
  const { data: folders, error: folderError } = await bucket.list(bookingId, { limit: 1000 });
  if (folderError) throw folderError;
  for (const folder of folders ?? []) {
    if (!folder.name) continue;
    const prefix = bookingId + "/" + folder.name;
    const { data: files, error: fileError } = await bucket.list(prefix, { limit: 1000 });
    if (fileError) throw fileError;
    const paths = (files ?? []).filter((item) => item.name).map((item) => prefix + "/" + item.name);
    if (paths.length) {
      const { error: removeError } = await bucket.remove(paths);
      if (removeError) throw removeError;
    }
  }
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
    if (userError || !user?.email) return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders(req) });

    const body = await req.json();
    const confirmation = String(body?.confirmation ?? "").trim();
    if (confirmation !== "DELETE") return Response.json({ error: "Type DELETE to confirm" }, { status: 400, headers: corsHeaders(req) });

    const key = serverKey();
    if (!key) throw new Error("Server configuration unavailable");
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: bookings, error: bookingError } = await admin
      .from("booking_requests")
      .select("id")
      .or("customer_id.eq." + user.id + ",companion_id.eq." + user.id);
    if (bookingError) throw bookingError;

    for (const booking of bookings ?? []) {
      await removeBookingMedia(admin, booking.id);
    }

    for (const bucketName of ["profile-photos", "listing-photos"]) {
      const { error } = await admin.storage.from(bucketName).remove([user.id + "/avatar.webp"]);
      if (error) throw error;
    }

    await admin.from("support_requests").delete().eq("user_id", user.id);
    await admin.from("support_requests").delete().eq("email", user.email.toLowerCase());

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return Response.json({ ok: true }, { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  } catch (error) {
    console.error("account_delete_failed");
    return Response.json({ error: "Could not delete the account. Please try again or contact support." }, { status: 500, headers: corsHeaders(req) });
  }
});
