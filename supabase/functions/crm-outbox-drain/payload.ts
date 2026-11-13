// Builds the body DeskcommCRM receives. Pure on purpose: no database, no
// network, no environment -- so the three stages and the consent rule can be
// tested directly.

export type Stage = "Em teste" | "Assinou" | "Teste encerrado";

/** One lead, as public.get_crm_lead returns it. */
export interface Lead {
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  consent_at: string | null;
  consent_version: string | null;
  utm: Record<string, unknown> | null;
}

export interface CrmPayload {
  external_id: string;
  name: string;
  phone: string;
  email: string;
  stage: Stage;
  ai_service_consent: true;
  ai_service_consent_version: string;
  submission_status: "completed";
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/**
 * The payload for this lead at this stage, or null when the lead must not be
 * sent at all.
 *
 * Consent is already checked in the database before anything is queued; this
 * is the second check, on the way out. It costs nothing and it means a consent
 * withdrawn after the row was queued still stops the send.
 */
export function buildPayload(lead: Lead, stage: Stage): CrmPayload | null {
  if (!lead.consent_at) return null;

  const phone = lead.phone?.trim();
  const email = lead.email?.trim();
  if (!phone || !email) return null;

  const payload: CrmPayload = {
    external_id: lead.user_id,
    name: lead.name?.trim() ?? "",
    phone,
    email,
    stage,
    ai_service_consent: true,
    ai_service_consent_version: lead.consent_version?.trim() ?? "",
    submission_status: "completed",
  };

  // Attribution travels only when it exists. An absent utm_source is an absent
  // key, never a null the CRM would have to interpret.
  for (const key of UTM_KEYS) {
    const value = lead.utm?.[key];
    if (typeof value === "string" && value.trim() !== "") {
      payload[key] = value.trim();
    }
  }

  return payload;
}
