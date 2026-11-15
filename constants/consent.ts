/**
 * The wording of the WhatsApp contact consent, identified by version.
 *
 * Stored alongside the acceptance in profiles.ai_contact_consent_version, so
 * rewording the checkbox later never changes what an earlier lead agreed to.
 * Bump this whenever the text itself changes in any language.
 *
 * v2 (15/11/2026): the consent stopped being its own checkbox and became part
 * of the privacy acceptance sentence, which is required to sign up. The two
 * versions therefore record different things — v1 was opted into on its own,
 * v2 came bundled — and that distinction is exactly why the version is stored.
 */
export const AI_CONSENT_VERSION = 'aura-trial-2026-11-v2';
