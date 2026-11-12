// Sending and rate-limiting for the authentication emails.
//
// The rate limit is not optional decoration. send-password-reset has to work
// for someone who cannot sign in, so it is a public endpoint that mails an
// address chosen by the caller. Without a ceiling, that is an open relay
// pointed at any inbox, sending from a domain Aura needs to keep deliverable.

import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { EMAIL_FROM } from "./emailLayout.ts";

export type EmailPurpose = "email_verification" | "password_reset";

export interface ThrottleRule {
  /** Shortest gap between two sends to the same address. */
  minIntervalSeconds: number;
  /** Ceiling within the trailing hour. */
  maxPerHour: number;
}

export const THROTTLE: Record<EmailPurpose, ThrottleRule> = {
  // Generous: someone who mistyped their address and fixed it should not be
  // locked out of a second attempt.
  email_verification: { minIntervalSeconds: 60, maxPerHour: 5 },
  // Tighter, because this one is reachable without a session.
  password_reset: { minIntervalSeconds: 60, maxPerHour: 3 },
};

export interface ThrottleDecision {
  allowed: boolean;
  reason?: "too_soon" | "hourly_cap";
  retryAfterSeconds?: number;
}

/**
 * Reads the trailing hour of sends for this address and purpose.
 *
 * Fails OPEN on a database error: a throttle table that cannot be read must
 * not be able to lock every club out of confirming their email. The ceiling is
 * an anti-abuse measure, not a security boundary.
 */
export async function checkThrottle(
  admin: SupabaseClient,
  email: string,
  purpose: EmailPurpose,
): Promise<ThrottleDecision> {
  const rule = THROTTLE[purpose];
  const since = new Date(Date.now() - 3600_000).toISOString();

  const { data, error } = await admin
    .from("auth_email_throttle")
    .select("sent_at")
    .eq("email", email.toLowerCase())
    .eq("purpose", purpose)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("throttle lookup failed, allowing send:", error.message);
    return { allowed: true };
  }

  const sends = data ?? [];
  if (sends.length >= rule.maxPerHour) {
    const oldest = new Date(sends[sends.length - 1].sent_at).getTime();
    const retry = Math.max(1, Math.ceil((oldest + 3600_000 - Date.now()) / 1000));
    return { allowed: false, reason: "hourly_cap", retryAfterSeconds: retry };
  }

  if (sends.length > 0) {
    const elapsed = (Date.now() - new Date(sends[0].sent_at).getTime()) / 1000;
    if (elapsed < rule.minIntervalSeconds) {
      return {
        allowed: false,
        reason: "too_soon",
        retryAfterSeconds: Math.ceil(rule.minIntervalSeconds - elapsed),
      };
    }
  }

  return { allowed: true };
}

export async function recordSend(
  admin: SupabaseClient,
  email: string,
  purpose: EmailPurpose,
): Promise<void> {
  const { error } = await admin
    .from("auth_email_throttle")
    .insert({ email: email.toLowerCase(), purpose });
  if (error) console.error("could not record send for throttling:", error.message);
}

/**
 * Hands the message to Resend. Returns false when the send failed, so the
 * caller can avoid recording a send that never happened.
 *
 * With no RESEND_API_KEY the message is logged instead of sent, which is how
 * these functions behave when run locally.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.log(`[dev] would email ${to}: ${subject}`);
    return true;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });

  if (!res.ok) {
    console.error(`Resend rejected the message for ${to}:`, await res.text());
    return false;
  }
  return true;
}
