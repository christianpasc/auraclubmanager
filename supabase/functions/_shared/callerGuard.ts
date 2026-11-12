// Who is calling, and are they allowed to make Aura send mail on their behalf.
//
// Two separate checks live here, for two separate problems.
//
// 1. MEMBERSHIP. send-invitations and send-invoice-email run with the service
//    role and were reached with verify_jwt: true — a valid session was
//    required, but nothing checked WHICH tenant the caller belonged to. Both
//    take record ids and mail whoever those records point at, so any signed-in
//    user could pass another club's invitation or invoice id and send in that
//    club's name. This closes that.
//
// 2. CONFIRMED ADDRESS. Signing up no longer requires confirming the email,
//    so a club can be created with an address its owner does not control.
//    Everything inside Aura stays open to them, by design — but sending mail
//    to third parties would make Aura the instrument for spamming guardians
//    from a borrowed identity. Those actions wait for the confirmation.

import { SupabaseClient, User } from "npm:@supabase/supabase-js@2.49.1";

export type GuardReason = "unauthorized" | "email_not_verified" | "not_a_member";

export interface GuardFailure {
  status: number;
  /** Carries a machine-readable reason so the UI can explain which wall it hit. */
  body: { error: string; reason: GuardReason };
}

export type GuardResult =
  | { ok: true; user: User }
  | { ok: false; failure: GuardFailure };

const MESSAGES: Record<GuardReason, string> = {
  unauthorized: "Unauthorized",
  email_not_verified:
    "Confirme seu e-mail para enviar mensagens em nome do clube. O link está na sua caixa de entrada.",
  not_a_member: "Você não tem acesso a este clube.",
};

function fail(reason: GuardReason, status: number): GuardResult {
  return { ok: false, failure: { status, body: { error: MESSAGES[reason], reason } } };
}

export async function getCaller(
  admin: SupabaseClient,
  req: Request,
): Promise<User | null> {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * profiles.email_verified_at is the flag, NOT
 * auth.users.email_confirmed_at — with Supabase's "Confirm email" off, GoTrue
 * fills its own column in at signup, so it no longer proves anything.
 *
 * Fails CLOSED on a read error: these are the outbound-mail paths, and the
 * safe answer when the flag cannot be read is to not send.
 */
export async function hasVerifiedEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .select("email_verified_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("could not read email_verified_at:", error.message);
    return false;
  }
  return !!data?.email_verified_at;
}

export async function isTenantMember(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("membership lookup failed:", error.message);
    return false;
  }
  return !!data;
}

/**
 * The full gate for an action that sends mail to third parties.
 *
 * `tenantIds` is every tenant touched by the request. An empty list is
 * rejected: a caller who reached this with no resolvable tenant has nothing
 * legitimate to send, and letting it through would reopen the hole this closes.
 */
export async function guardOutboundEmail(
  admin: SupabaseClient,
  req: Request,
  tenantIds: string[],
): Promise<GuardResult> {
  const user = await getCaller(admin, req);
  if (!user) return fail("unauthorized", 401);

  if (!(await hasVerifiedEmail(admin, user.id))) {
    return fail("email_not_verified", 403);
  }

  const unique = [...new Set(tenantIds.filter(Boolean))];
  if (unique.length === 0) return fail("not_a_member", 403);

  for (const tenantId of unique) {
    if (!(await isTenantMember(admin, tenantId, user.id))) {
      return fail("not_a_member", 403);
    }
  }

  return { ok: true, user };
}
