import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { appBaseUrl, sha256Hex } from "../_shared/emailLayout.ts";

// The target of the link in the confirmation email.
//
// Deliberately unauthenticated (verify_jwt: false): the person clicking is in
// their email client, quite possibly on a phone that has never signed in to
// Aura. Possession of the token IS the proof — that is the whole point of
// having mailed it to an address only they can read.
//
// Always answers with a redirect rather than JSON, because a browser is what
// opens this. The outcome travels as a query parameter so the app can say what
// happened instead of silently doing nothing.
//
// Secrets: APP_BASE_URL (optional).

function redirect(outcome: string): Response {
  const url = `${appBaseUrl()}/?email_verified=${outcome}`;
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req: Request) => {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return redirect("invalid");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // The database only ever held the hash, so the lookup hashes the token
    // from the URL and compares that.
    const { data: row, error } = await admin
      .from("auth_email_tokens")
      .select("id, user_id, expires_at, consumed_at")
      .eq("token_hash", await sha256Hex(token))
      .eq("purpose", "email_verification")
      .maybeSingle();

    if (error) {
      console.error("token lookup failed:", error.message);
      return redirect("error");
    }
    if (!row) return redirect("invalid");

    // Already used. Treated as success, not failure: the usual cause is a
    // second click or an email client prefetching the link, and telling
    // someone their confirmation failed when their account is in fact
    // confirmed would be worse than wrong.
    if (row.consumed_at) return redirect("1");

    if (new Date(row.expires_at).getTime() < Date.now()) return redirect("expired");

    const now = new Date().toISOString();

    const { error: profileError } = await admin
      .from("profiles")
      .update({ email_verified_at: now })
      .eq("id", row.user_id);

    if (profileError) {
      console.error("could not mark profile verified:", profileError.message);
      return redirect("error");
    }

    // Burn the token only after the flag is set. The other order could leave
    // someone with a spent link and an unverified account — unrecoverable
    // without support, since the link cannot be reissued for a consumed token.
    const { error: consumeError } = await admin
      .from("auth_email_tokens")
      .update({ consumed_at: now })
      .eq("id", row.id);

    if (consumeError) {
      // The account is verified, which is what the person came for. Log it and
      // let them through; the token expires on its own within 24 hours.
      console.error("verified but could not consume token:", consumeError.message);
    }

    return redirect("1");
  } catch (err: any) {
    console.error("verify-email error:", err?.message || err);
    return redirect("error");
  }
});
