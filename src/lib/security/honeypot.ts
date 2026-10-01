import "server-only";

// Spam protection for public forms (with rate limiting in rate-limit.ts):
//  • a hidden "honeypot" field people never see or fill, but form-filling bots do;
//  • a minimum time between showing the form and submitting it.
// Use <HoneypotFields /> in the form and checkHoneypot(form) in the server action.

export const HONEYPOT_FIELD = "company_fax";
export const STARTED_FIELD = "form_started";
const MIN_FILL_MS = 2500;

export function checkHoneypot(form: FormData): { spam: boolean; reason?: string } {
  if (String(form.get(HONEYPOT_FIELD) ?? "").trim() !== "") return { spam: true, reason: "honeypot" };
  const started = Number(form.get(STARTED_FIELD));
  if (!started || Date.now() - started < MIN_FILL_MS) return { spam: true, reason: "too_fast" };
  return { spam: false };
}
