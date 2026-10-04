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

async function exactCount(query: any) {
  const { count, error } = await query;
  if (error) throw error;
  return Number(count ?? 0);
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

    const { data: adminRow, error: adminError } = await userClient
      .from("platform_admins")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !adminRow) return Response.json({ error: "Admin access required" }, { status: 403, headers: corsHeaders });

    const key = serverKey();
    if (!key) throw new Error("Server key unavailable");

    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: baseData, error: baseError } = await admin.rpc("admin_dashboard_stats_server");
    if (baseError) throw baseError;
    const base = Array.isArray(baseData) ? baseData[0] : baseData;

    const [pendingBookings,acceptedBookings,declinedBookings,cancelledBookings,completedBookings,publishedCompanions,openReports,openSupport] = await Promise.all([
      exactCount(admin.from("booking_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
      exactCount(admin.from("booking_requests").select("*", { count: "exact", head: true }).eq("status", "accepted")),
      exactCount(admin.from("booking_requests").select("*", { count: "exact", head: true }).eq("status", "declined")),
      exactCount(admin.from("booking_requests").select("*", { count: "exact", head: true }).eq("status", "cancelled")),
      exactCount(admin.from("booking_requests").select("*", { count: "exact", head: true }).eq("status", "completed")),
      exactCount(admin.from("companion_listings").select("*", { count: "exact", head: true }).eq("published", true).eq("moderation_status", "active")),
      exactCount(admin.from("user_reports").select("*", { count: "exact", head: true }).eq("status", "open")),
      exactCount(admin.from("support_requests").select("*", { count: "exact", head: true }).in("status", ["open", "reviewed"])),
    ]);

    return Response.json({
      ...(base ?? {}),
      pending_bookings: pendingBookings,
      accepted_bookings: acceptedBookings,
      declined_bookings: declinedBookings,
      cancelled_bookings: cancelledBookings,
      completed_bookings: completedBookings,
      published_companions: publishedCompanions,
      open_reports: openReports,
      open_support: openSupport,
    }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not load admin statistics" }, { status: 500, headers: corsHeaders });
  }
});
