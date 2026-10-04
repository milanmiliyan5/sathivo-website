import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowed = new Set(["account","privacy","safety","technical","feedback","other"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = serverKey();
    if (!url || !key) throw new Error("Server configuration unavailable");
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = await req.json();
    if (String(body?.website ?? "").trim()) {
      return Response.json({ ok: true }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 254);
    const category = String(body?.category ?? "").trim();
    const subject = String(body?.subject ?? "").trim();
    const message = String(body?.message ?? "").trim();
    const ratingValue = Number(body?.rating ?? 0);
    const rating = Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null;
    const feedbackType = String(body?.feedback_type ?? "").trim();
    const allowedFeedbackTypes = new Set(["suggestion","bug","experience","compliment","other"]);

    if (!emailRe.test(email)) return Response.json({ error: "Enter a valid email address" }, { status: 400, headers: corsHeaders });
    if (!allowed.has(category)) return Response.json({ error: "Choose a valid support category" }, { status: 400, headers: corsHeaders });
    if (subject.length < 3 || subject.length > 120) return Response.json({ error: "Subject must be 3–120 characters" }, { status: 400, headers: corsHeaders });
    if (message.length < 10 || message.length > 3000) return Response.json({ error: "Message must be 10–3000 characters" }, { status: 400, headers: corsHeaders });
    if (category === "feedback" && body?.rating !== undefined && rating === null) return Response.json({ error: "Choose a rating from 1 to 5" }, { status: 400, headers: corsHeaders });
    if (category === "feedback" && feedbackType && !allowedFeedbackTypes.has(feedbackType)) return Response.json({ error: "Choose a valid feedback type" }, { status: 400, headers: corsHeaders });

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= 5) return Response.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: corsHeaders });

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("support_submit_failed");
    return Response.json({ error: "Could not send your request. Please try again." }, { status: 500, headers: corsHeaders });
  }
});
