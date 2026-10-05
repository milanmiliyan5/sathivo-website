import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

let vapidReady = false;

async function ensureVapid(admin) {
  if (vapidReady) return;
  const { data, error } = await admin.rpc("get_vapid_config_server");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const publicKey = String(row?.public_key ?? "");
  const privateKey = String(row?.private_key ?? "");
  if (publicKey.length !== 87 || privateKey.length < 40) {
    throw new Error("Web Push configuration unavailable");
  }
  webpush.setVapidDetails("mailto:no-reply@auth.sathivo.co", publicKey, privateKey);
  vapidReady = true;
}

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

function bookingMessage(event, b) {
  if (event === "request") return {
    target: b.companion_id,
    title: "New booking request",
    body: `${b.customer_display_name || "Someone"} sent you a ${b.category} request${b.offered_hourly_rate ? ` with an offer of ₹${Number(b.offered_hourly_rate).toLocaleString("en-IN")}/hour` : ""}.`,
    url: `requests.html?id=${b.id}`,
  };
  if (event === "accepted") return {
    target: b.customer_id,
    title: "Request accepted ✅",
    body: `${b.companion_display_name || "Your companion"} accepted your request${b.agreed_hourly_rate ? ` at ₹${Number(b.agreed_hourly_rate).toLocaleString("en-IN")}/hour` : ""}. Chat and photo sharing are now open.`,
    url: `chat.html?booking=${b.id}`,
  };
  if (event === "declined") return {
    target: b.customer_id,
    title: "Request declined",
    body: `${b.companion_display_name || "Your companion"} declined your request.`,
    url: `bookings.html?id=${b.id}`,
  };
  if (event === "cancelled") return {
    target: b.customer_id === b._caller ? b.companion_id : b.customer_id,
    title: "Booking cancelled",
    body: "A companionship request was cancelled.",
    url: `bookings.html?id=${b.id}`,
  };
  if (event === "completed") return {
    target: b.customer_id,
    title: "Booking completed",
    body: `${b.companion_display_name || "Your companion"} marked the booking completed.`,
    url: `bookings.html?id=${b.id}`,
  };
  return null;
}

async function deliver(admin, target, payload) {
  const { data: subscriptions, error: subError } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth_key")
    .eq("user_id", target);
  if (subError) throw subError;

  let sent = 0;
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify(payload),
        { TTL: 300, urgency: "high" },
      );
      sent++;
    } catch (error) {
      const statusCode = Number(error?.statusCode ?? 0);
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("Push send failed", statusCode, error?.message ?? error);
      }
    }
  }
  return sent;
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
    await ensureVapid(admin);

    const body = await req.json();
    const event = String(body?.event ?? "");

    if (event === "test") {
      const sent = await deliver(admin, user.id, {
        title: "Sathivo notifications are working ✅",
        body: "You will receive booking and chat updates on this device.",
        url: "notifications.html",
        tag: "sathivo-test",
      });
      return Response.json({ ok: true, sent }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const bookingId = String(body?.booking_id ?? "");
    const messageId = String(body?.message_id ?? "");
    const validEvents = ["request","accepted","declined","cancelled","completed","message"];
    if (!/^[0-9a-f-]{36}$/i.test(bookingId) || !validEvents.includes(event)) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders });
    }

    const { data: booking, error: bookingError } = await userClient
      .from("booking_requests")
      .select("id,customer_id,companion_id,customer_display_name,companion_display_name,category,status,offered_hourly_rate,agreed_hourly_rate")
      .eq("id", bookingId)
      .single();
    if (bookingError || !booking) return Response.json({ error: "Booking unavailable" }, { status: 404, headers: corsHeaders });

    const callerIsCustomer = booking.customer_id === user.id;
    const callerIsCompanion = booking.companion_id === user.id;
    if (!callerIsCustomer && !callerIsCompanion) {
      return Response.json({ error: "Not a booking participant" }, { status: 403, headers: corsHeaders });
    }

    let msg;
    let tagSuffix = event;

    if (event === "message") {
      if (!/^[0-9a-f-]{36}$/i.test(messageId) || booking.status !== "accepted") {
        return Response.json({ error: "Invalid message push" }, { status: 400, headers: corsHeaders });
      }
      const { data: chatMessage, error: messageError } = await userClient
        .from("booking_messages")
        .select("id,booking_id,sender_id,message_type")
        .eq("id", messageId)
        .eq("booking_id", bookingId)
        .single();
      if (messageError || !chatMessage) return Response.json({ error: "Message unavailable" }, { status: 404, headers: corsHeaders });
      if (chatMessage.sender_id !== user.id) return Response.json({ error: "Only the sender can trigger this push" }, { status: 403, headers: corsHeaders });

      const target = callerIsCustomer ? booking.companion_id : booking.customer_id;
      const senderName = callerIsCustomer
        ? (booking.customer_display_name || "Your Sathivo connection")
        : (booking.companion_display_name || "Your Sathivo connection");
      const isPhoto = chatMessage.message_type === "image";
      msg = {
        target,
        title: isPhoto ? `New photo from ${senderName}` : `New message from ${senderName}`,
        body: isPhoto ? "A photo was shared in your accepted Sathivo chat." : "You have a new message in your Sathivo chat.",
        url: `chat.html?booking=${booking.id}`,
      };
      tagSuffix = `message-${messageId}`;

      const { error: deliveryError } = await admin.from("push_message_delivery_events").insert({
        message_id: messageId,
        booking_id: booking.id,
        target_user_id: target,
      });
      if (deliveryError?.code === "23505") {
        return Response.json({ ok: true, duplicate: true, sent: 0 }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (deliveryError) throw deliveryError;
    } else {
      const allowed =
        (event === "request" && callerIsCustomer && booking.status === "pending") ||
        (event === "accepted" && callerIsCompanion && booking.status === "accepted") ||
        (event === "declined" && callerIsCompanion && booking.status === "declined") ||
        (event === "cancelled" && booking.status === "cancelled") ||
        (event === "completed" && callerIsCompanion && booking.status === "completed");
      if (!allowed) return Response.json({ error: "Push event does not match booking state" }, { status: 403, headers: corsHeaders });

      booking._caller = user.id;
      msg = bookingMessage(event, booking);
      if (!msg) return Response.json({ error: "Unsupported event" }, { status: 400, headers: corsHeaders });

      const { error: deliveryError } = await admin.from("push_delivery_events").insert({
        booking_id: booking.id,
        event,
        target_user_id: msg.target,
      });
      if (deliveryError?.code === "23505") {
        return Response.json({ ok: true, duplicate: true, sent: 0 }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (deliveryError) throw deliveryError;
    }

    const sent = await deliver(admin, msg.target, {
      title: msg.title,
      body: msg.body,
      url: msg.url,
      tag: `sathivo-${booking.id}-${tagSuffix}`,
    });

    return Response.json({ ok: true, sent }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500, headers: corsHeaders });
  }
});
