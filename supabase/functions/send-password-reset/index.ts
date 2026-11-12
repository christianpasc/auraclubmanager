import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { appBaseUrl, renderEmail } from "../_shared/emailLayout.ts";
import { AUTH_COPY, resolveLang } from "../_shared/authEmailCopy.ts";
import { checkThrottle, recordSend, sendEmail } from "../_shared/emailSend.ts";

// Password reset, in Aura's template and the user's language.
//
// Replaces supabase.auth.resetPasswordForEmail(). Two reasons it had to move:
// the mail went out branded as Supabase in one language, and it was sent
// through the built-in email service — capped at a handful of messages an hour
// across every auth email at once, so a reset could silently never arrive.
//
// Supabase still mints the credential. generateLink() produces the recovery
// token WITHOUT sending anything, and the hashed_token it returns is what the
// /reset-password screen feeds to verifyOtp(). Aura only carries it.
//
// The link is assembled here rather than using generateLink's own action_link
// because the app runs on a HashRouter: Supabase would append ?code= outside
// the fragment, where the client cannot see it. Building
// /#/reset-password?token_hash=... keeps the parameter where the route reads it.
//
// Public by necessity (verify_jwt: false) — whoever needs this cannot sign in.
// That makes two things non-negotiable:
//   1. The response is ALWAYS 200, whether or not the account exists. Any
//      difference would turn this into an endpoint for testing which emails
//      are registered with Aura.
//   2. It is rate-limited. Otherwise it is an open relay that mails any
//      address on request, from the domain Aura needs to keep deliverable.
//
// Secrets: RESEND_API_KEY, APP_BASE_URL (optional).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// One body for every outcome: sent, throttled, unknown address, or Resend
// failure. The caller is told only that the request was accepted.
const ACCEPTED = { success: true };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    // A malformed address is still answered with 200: the screen behaves
    // identically whatever the caller typed.
    if (!email || !email.includes("@")) return json(ACCEPTED);

    const decision = await checkThrottle(admin, email, "password_reset");
    if (!decision.allowed) {
      console.log(`password reset throttled for ${email}: ${decision.reason}`);
      return json(ACCEPTED);
    }

    // Mints the recovery token without sending mail. Fails for an address
    // with no account, which is exactly how an unknown email is handled —
    // logged, then answered the same as a successful one.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (linkError || !link?.properties?.hashed_token) {
      console.log(`no recovery link for ${email}: ${linkError?.message ?? "no token"}`);
      return json(ACCEPTED);
    }

    const tokenHash = link.properties.hashed_token;
    const user = link.user;

    const { data: profile } = user?.id
      ? await admin
          .from("profiles")
          .select("full_name, language")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };

    // The requester's current interface language is a better guess than the
    // profile for someone who cannot sign in, but the profile wins when set.
    const lang = resolveLang(profile?.language ?? body?.language);
    const copy = AUTH_COPY[lang].passwordReset;

    const resetUrl =
      `${appBaseUrl()}/#/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;

    const html = renderEmail({
      greeting: copy.greeting(profile?.full_name ?? ""),
      heading: copy.heading,
      body: copy.body,
      ctaLabel: copy.cta,
      ctaUrl: resetUrl,
      linkFallback: copy.linkFallback,
      signoff: copy.signoff,
      footer: copy.footer,
    });

    const sent = await sendEmail(email, copy.subject, html);
    if (sent) {
      await recordSend(admin, email, "password_reset");
    }

    return json(ACCEPTED);
  } catch (err: any) {
    // Even an internal fault answers 200. The alternative leaks that something
    // about this particular address behaved differently.
    console.error("send-password-reset error:", err?.message || err);
    return json(ACCEPTED);
  }
});
