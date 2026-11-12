// The visual shell every Aura transactional email shares.
//
// Extracted from send-trial-emails/copy.ts, which was the first function to
// get a presentable template. The authentication emails now go out from two
// more functions, and three hand-copied HTML blocks would have drifted apart
// within a release or two — the whole point of this work is that Aura's email
// stops looking like it came from somewhere else.
//
// Inline styles only, and no external stylesheet: every mail client of
// consequence strips <style> blocks.

export interface EmailParts {
  /** "Olá, Chris!" — already localized by the caller. */
  greeting: string;
  heading: string;
  /** May contain inline HTML; the callers build it from their own copy. */
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  /** Shown under the button, for clients that swallow the link. */
  linkFallback?: string;
  signoff?: string;
  footer: string;
}

const BRAND = "#2f93ff";
const INK = "#1f2937";
const INK_STRONG = "#111827";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const RULE = "#e5e7eb";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function renderEmail(parts: EmailParts): string {
  const signoff = parts.signoff
    ? `<p style="color:${MUTED}">${parts.signoff}</p>`
    : "";

  // The raw URL is spelled out because these are the two emails a person
  // cannot work around: if the button fails to render, the account is stuck.
  const fallback = parts.linkFallback
    ? `<p style="color:${MUTED};font-size:13px;margin:0 0 4px">${parts.linkFallback}</p>
       <p style="margin:0 0 20px;font-size:13px;word-break:break-all">
         <a href="${parts.ctaUrl}" style="color:${BRAND}">${parts.ctaUrl}</a>
       </p>`
    : "";

  return `
    <div style="font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};max-width:560px">
      <p>${parts.greeting}</p>
      <h2 style="font-size:19px;margin:18px 0 10px;color:${INK_STRONG}">${parts.heading}</h2>
      <p>${parts.body}</p>
      <p style="margin:26px 0">
        <a href="${parts.ctaUrl}"
           style="background:${BRAND};color:#ffffff;padding:13px 26px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">
          ${parts.ctaLabel}
        </a>
      </p>
      ${fallback}
      ${signoff}
      <hr style="border:none;border-top:1px solid ${RULE};margin:24px 0"/>
      <p style="color:${FAINT};font-size:12px;">${parts.footer}</p>
    </div>
  `;
}

/** Every Aura email leaves from the same address and display name. */
export const EMAIL_FROM = "Aura Club Manager <noreply@auraclubmanager.io>";

export function appBaseUrl(): string {
  const configured = Deno.env.get("APP_BASE_URL") ?? "https://app.auraclubmanager.io";
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

/**
 * Hex SHA-256. Tokens are mailed in the clear by necessity, so only this hash
 * is ever written to the database.
 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
