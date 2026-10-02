import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { cached, invalidate } from "@/lib/content/cache";

// Contact details and switches from Admin → Settings. Anything not set there falls back to the
// server setting in .env, so a fresh install works before anyone opens Settings.

const NAME = "site-settings";

export type Settings = {
  orgLegalName: string;
  orgAddress: string;
  orgPhone: string;
  orgPhoneTel: string;
  orgEmail: string;
  orgEin: string | null;
  contactInbox: string;
  showResubBarSitewide: boolean;
  defaultDonationFrequency: "one-time" | "monthly";
};

export const ENV_DEFAULTS: Settings = {
  orgLegalName: env.ORG_LEGAL_NAME,
  orgAddress: env.ORG_ADDRESS,
  orgPhone: env.ORG_PHONE,
  orgPhoneTel: env.ORG_PHONE_TEL,
  orgEmail: env.ORG_EMAIL,
  orgEin: env.ORG_EIN ?? null,
  contactInbox: env.CONTACT_INBOX,
  showResubBarSitewide: env.SHOW_RESUB_BAR_SITEWIDE,
  defaultDonationFrequency: env.DEFAULT_DONATION_FREQUENCY,
};

export async function getSettings(): Promise<Settings> {
  const row = await cached(NAME, 15_000, () => db.siteSettings.findUnique({ where: { id: 1 } }));
  if (!row) return ENV_DEFAULTS;
  const pick = <K extends keyof Settings>(k: K): Settings[K] => (row[k] ?? ENV_DEFAULTS[k]) as Settings[K];
  return {
    orgLegalName: pick("orgLegalName"),
    orgAddress: pick("orgAddress"),
    orgPhone: pick("orgPhone"),
    orgPhoneTel: pick("orgPhoneTel"),
    orgEmail: pick("orgEmail"),
    orgEin: pick("orgEin"),
    contactInbox: pick("contactInbox"),
    showResubBarSitewide: pick("showResubBarSitewide"),
    defaultDonationFrequency: row.defaultDonationFrequency === "one-time" || row.defaultDonationFrequency === "monthly" ? row.defaultDonationFrequency : ENV_DEFAULTS.defaultDonationFrequency,
  };
}

export function invalidateSettings() {
  invalidate(NAME);
}
