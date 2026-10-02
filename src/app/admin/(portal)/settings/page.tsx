import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { ENV_DEFAULTS, getSettings } from "@/lib/settings";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { saveSettings } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const FIELDS = [
  { name: "orgLegalName", label: "Organization name", hint: "On receipts, statements and calendar files." },
  { name: "orgAddress", label: "Address", hint: "Footer, About Us, map, receipts. The footer leaves out the ZIP code." },
  { name: "orgPhone", label: "Phone (as shown)", hint: "e.g. 925-298-BMCC (2622)" },
  { name: "orgPhoneTel", label: "Phone (for dialing)", hint: "What phones dial when the number is tapped, e.g. +19252982622" },
  { name: "orgEmail", label: "Public email", hint: "Footer and About Us." },
  { name: "orgEin", label: "EIN", hint: "Printed on donation receipts and giving statements once set (e.g. 12-3456789)." },
  { name: "contactInbox", label: "Office inbox", hint: "Receives contact-form messages, new directory listings and members' requests." },
] as const;

export default async function SettingsAdmin() {
  await requireSection("settings");
  const [row, current] = await Promise.all([db.siteSettings.findUnique({ where: { id: 1 } }), getSettings()]);

  return (
    <>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.pageLead}>
        BMCC&apos;s contact details and a few site-wide switches. Leave a box empty to use the server&apos;s default (shown in grey).
        Technical settings — email sending, payments, sign-in, storage — stay in the server configuration.
      </p>
      <section className={styles.card} aria-labelledby="contact-settings">
        <ActionForm action={saveSettings} submitLabel="Save settings">
          <h2 id="contact-settings" className={styles.cardTitle}>
            Contact details
          </h2>
          <div className={styles.grid2} style={{ gap: "14px 20px" }}>
            {FIELDS.map((f) => (
              <div key={f.name} className={styles.field}>
                <label className={styles.label} htmlFor={`s-${f.name}`}>
                  {f.label}
                </label>
                <input id={`s-${f.name}`} name={f.name} defaultValue={row?.[f.name] ?? ""} placeholder={ENV_DEFAULTS[f.name] ?? "Not set"} className={styles.input} />
                <span className={styles.hint}>{f.hint}</span>
              </div>
            ))}
          </div>

          <h2 className={styles.cardTitle} style={{ marginTop: 22 }}>
            Site switches
          </h2>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14.5, marginBottom: 14 }}>
            <input type="checkbox" name="showResubBarSitewide" defaultChecked={current.showResubBarSitewide} style={{ marginTop: 3 }} />
            <span>
              Show the “please re-subscribe” bar on every page
              <span className={styles.hint} style={{ display: "block" }}>
                Off: Home only. Turn on for the length of the re-subscribe campaign.
              </span>
            </span>
          </label>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className={styles.label}>Donate page starts on</legend>
            <label style={{ marginInlineEnd: 18, fontSize: 14.5 }}>
              <input type="radio" name="defaultDonationFrequency" value="monthly" defaultChecked={current.defaultDonationFrequency === "monthly"} /> Monthly
            </label>
            <label style={{ fontSize: 14.5 }}>
              <input type="radio" name="defaultDonationFrequency" value="one-time" defaultChecked={current.defaultDonationFrequency === "one-time"} /> One-time
            </label>
          </fieldset>
        </ActionForm>
      </section>
    </>
  );
}
