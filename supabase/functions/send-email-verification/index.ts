import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { appBaseUrl, renderEmail, sha256Hex } from "../_shared/emailLayout.ts";
import { AUTH_COPY, resolveLang } from "../_shared/authEmailCopy.ts";
import { checkThrottle, recordSend, sendEmail } from "../_shared/emailSend.ts";

// Sends the "confirm your email" message, in Aura's own template and the
// user's own language.
//
// This replaces the Supabase Auth confirmation email, which went out branded
// as Supabase, in a single language, through the built-in email service that
// is capped at a handful of messages an hour. Once "Confirm email" is turned
// off in the dashboard, GoTrue stops sending anything at all — so this
// function is the only thing standing between a new club and an unverifiable
// address.
//
// Called twice over a club's life: right after signup, and again whenever
// somebody presses "resend" on the banner. Both paths carry the user's JWT,
// so the address is never chosen by the caller — it is read from the session.
//
// Secrets: RESEND_API_KEY, APP_BASE_URL (optional).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** 32 bytes of entropy, URL-safe: it travels as a query parameter. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user?.email) return json({ error: "Unauthorized" }, 401);

    const user = userData.user;
    const email = user.email!;

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, language, email_verified_at")
      .eq("id", user.id)
      .maybeSingle();

    // Nothing to do, and worth saying so plainly: the banner polls this state
    // and a stale tab could ask again after the link was already used.
    if (profile?.email_verified_at) {
      return json({ already_verified: true });
    }

    const decision = await checkThrottle(admin, email, "email_verification");
    if (!decision.allowed) {
      return json(
        {
          error: "throttled",
          reason: decision.reason,
          retry_after_seconds: decision.retryAfterSeconds,
        },
        429,
      );
    }

    // Any token issued earlier is void from here on. Otherwise a resend would
    // leave several live links in several inboxes.
    await admin
      .from("auth_email_tokens")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("purpose", "email_verification")
      .is("consumed_at", null);

    const plain = newToken();
    const expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();

    const { error: insertError } = await admin.from("auth_email_tokens").insert({
      user_id: user.id,
      purpose: "email_verification",
      token_hash: await sha256Hex(plain),
      expires_at: expiresAt,
    });
    if (insertError) {
      console.error("could not store verification token:", insertError.message);
      return json({ error: "Não foi possível gerar o link de confirmação." }, 500);
    }

    const lang = resolveLang(profile?.language ?? user.user_metadata?.language);
    const copy = AUTH_COPY[lang].verification;
    const verifyUrl =
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-email?token=${plain}`;

    const html = renderEmail({
      greeting: copy.greeting(profile?.full_name ?? user.user_metadata?.full_name ?? ""),
      heading: copy.heading,
      body: copy.body,
      ctaLabel: copy.cta,
      ctaUrl: verifyUrl,
      linkFallback: copy.linkFallback,
      signoff: copy.signoff,
      footer: copy.footer,
    });

    const sent = await sendEmail(email, copy.subject, html);
    if (!sent) {
      return json({ error: "Não foi possível enviar o e-mail de confirmação." }, 502);
    }

    // Recorded only on success, so a Resend outage does not burn the quota.
    await recordSend(admin, email, "email_verification");

    return json({ success: true, sent_to: email, language: lang });
  } catch (err: any) {
    console.error("send-email-verification error:", err?.message || err);
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});
