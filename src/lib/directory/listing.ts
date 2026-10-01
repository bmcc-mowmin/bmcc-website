// Validation and normalization for directory listings — shared by the public "Submit a Listing"
// form, admin edits and the CSV import. No database here, so it can be unit tested.
import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

// Accepts "example.com" and adds https:// — but only http(s) URLs are ever stored.
const website = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const url = new URL(withScheme);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error();
      return url.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "form_error_url" });
      return z.NEVER;
    }
  });

const phone = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const digits = v.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      ctx.addIssue({ code: "custom", message: "form_error_phone" });
      return z.NEVER;
    }
    // US numbers are shown as (925) 555-0123; anything else is kept as typed.
    const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    return us.length === 10 ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : v;
  });

export const listingSchema = z.object({
  listingType: z.enum(["BUSINESS", "INDIVIDUAL"], { message: "form_error_required" }),
  name: trimmed(120).min(2, "form_error_required"),
  parentCategory: trimmed(80).min(2, "form_error_required"),
  category: trimmed(80).min(2, "form_error_required"),
  tags: z
    .string()
    .optional()
    .transform((v) =>
      Array.from(new Set((v ?? "").split(/[,;]/).map((t) => t.trim()).filter(Boolean))).slice(0, 8).map((t) => t.slice(0, 40)),
    ),
  description: trimmed(1200).min(10, "form_error_required"),
  author: trimmed(120).min(2, "form_error_required"),
  phone,
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null)
    .pipe(z.email({ message: "form_error_email" }).nullable()),
  website,
  address: optional(200),
  city: optional(80),
  state: optional(40),
  zip: optional(12),
});

export type ListingInput = z.output<typeof listingSchema>;

// Field → first error message key (for showing errors next to inputs).
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message.startsWith("form_error_") ? issue.message : "form_error_required";
  }
  return out;
}

// "Location" shown in the table: the city, if any.
export const locationOf = (l: { city: string | null }) => l.city ?? "";

// Google Maps links for the details popup (null when there is no address/city to show).
export function mapLinks(l: { name: string; address: string | null; city: string | null; state: string | null; zip: string | null; googleMapUrl?: string | null }, embedKey?: string) {
  const place = [l.address, l.city, [l.state, l.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (!l.address && !l.city) return null;
  const q = encodeURIComponent(`${l.name}, ${place}`);
  return {
    embed: embedKey
      ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(embedKey)}&q=${q}`
      : `https://maps.google.com/maps?q=${q}&z=15&output=embed`,
    open: l.googleMapUrl || `https://www.google.com/maps/search/?api=1&query=${q}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  };
}
