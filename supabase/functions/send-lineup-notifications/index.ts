import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const { notificationIds, gameInfo } = await req.json() as {
      notificationIds: string[];
      gameInfo: { matchLabel: string; dateLabel: string };
    };

    if (!notificationIds?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch notifications with profile emails
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, profiles!user_id(email, full_name)")
      .in("id", notificationIds)
      .is("sent_at", null);

    if (error || !notifications) {
      console.error("Failed to fetch notifications:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch notifications" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    const sentIds: string[] = [];

    for (const notif of notifications) {
      const profile = notif.profiles as any;
      const email = profile?.email;
      const name = profile?.full_name || "Atleta";

      if (!email) continue;

      if (resendApiKey) {
        // Send via Resend
        const emailBody = {
          from: "Aura Club Manager <noreply@auraclubmanager.com>",
          to: [email],
          subject: notif.title,
          html: `
            <p>Olá, <strong>${name}</strong>!</p>
            <p>${notif.body}</p>
            <p><strong>Jogo:</strong> ${gameInfo.matchLabel}${gameInfo.dateLabel ? `<br><strong>Data:</strong> ${gameInfo.dateLabel}` : ""}</p>
            <hr />
            <p style="color:#888;font-size:12px;">Aura Club Manager &mdash; Gestão esportiva inteligente</p>
          `,
        };

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailBody),
        });

        if (res.ok) {
          sent++;
          sentIds.push(notif.id);
        } else {
          console.error("Resend error for", email, await res.text());
        }
      } else {
        // No email provider configured — mark as sent anyway so we don't retry
        sent++;
        sentIds.push(notif.id);
      }
    }

    // Mark sent
    if (sentIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ sent_at: new Date().toISOString() })
        .in("id", sentIds);
    }

    return new Response(JSON.stringify({ sent, total: notifications.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-lineup-notifications error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
