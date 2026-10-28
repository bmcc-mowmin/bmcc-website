"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail } from "@/lib/admin/forms";
import { invalidateSettings } from "@/lib/settings";

// Blank = use the server default (.env).
const blank = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const schema = z.object({
  orgLegalName: z.string().max(120).nullable(),
  orgAddress: z.string().max(200).nullable(),
  orgPhone: z.string().max(40).nullable(),
  orgPhoneTel: z.string().regex(/^\+\d{8,15}$/, "Phone for dialing must look like +19252982622").nullable(),
  orgEmail: z.email("Public email isn't a valid email address").nullable(),
  orgEin: z.string().regex(/^\d{2}-\d{7}$/, "EIN must look like 12-3456789").nullable(),
  contactInbox: z.email("Office inbox isn't a valid email address").nullable(),
  bugInbox: z.email("Bug reports inbox isn't a valid email address").nullable(),
  showResubBarSitewide: z.boolean(),
  defaultDonationFrequency: z.enum(["one-time", "monthly"]),
});

export async function saveSettings(_prev: unknown, form: FormData) {
  const user = await requireSection("settings");
  const parsed = schema.safeParse({
    orgLegalName: blank(form.get("orgLegalName")),
    orgAddress: blank(form.get("orgAddress")),
    orgPhone: blank(form.get("orgPhone")),
    orgPhoneTel: blank(form.get("orgPhoneTel")),
    orgEmail: blank(form.get("orgEmail")),
    orgEin: blank(form.get("orgEin")),
    contactInbox: blank(form.get("contactInbox")),
    bugInbox: blank(form.get("bugInbox")),
    showResubBarSitewide: form.get("showResubBarSitewide") === "on",
    defaultDonationFrequency: form.get("defaultDonationFrequency"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the fields.");
  const before = await db.siteSettings.findUnique({ where: { id: 1 } });
  await db.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
  const changed = Object.fromEntries(Object.entries(parsed.data).filter(([k, v]) => (before as Record<string, unknown> | null)?.[k] !== v));
  if (Object.keys(changed).length) await audit(user.id, "update", "Settings", "site", changed);
  invalidateSettings();
  revalidatePath("/", "layout");
  return done("Saved. The site uses the new settings now.");
}
