import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { getOrg } from "@/lib/org";
import { isProduction } from "@/lib/env";
import { routes } from "@/lib/routes";
import styles from "./privacy.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.privacy_title };
}

// DRAFT for review by BMCC's board / attorney before launch (see TECH_TODO.md → Privacy). The
// policy is in English (like receipts, an official record); the page title and footer link are
// translated. The banner below shows on every non-production site.
const EFFECTIVE = "[effective date — set at launch]";
const TO_CONFIRM = [
  "How long payment and receipt records are kept (proposed: 7 years) — the accountant decides.",
  "How long contact messages and lapsed-membership records are kept (proposed: 2 and 7 years).",
  "Which services are in use at launch (Stripe, PayPal, Clerk, Resend, Render, Cloudflare, Constant Contact).",
  "Who handles privacy requests and the address to send them to.",
];

export default async function PrivacyPage() {
  const [{ t }, org] = await Promise.all([getI18n(), getOrg()]);
  return (
    <section className="container-policy section-y">
      <div className="page-intro">
        <h1 className="page-h1">{t.privacy_title}</h1>
        <p className={styles.meta} lang="en">
          {org.legalName} · Effective {EFFECTIVE}
        </p>
        <p className={styles.meta}>{t.privacy_english_note}</p>
      </div>

      {!isProduction && (
        <div className={styles.draft} role="note" lang="en">
          <strong>Draft for review — not yet in effect.</strong> To confirm before launch:
          <ul>
            {TO_CONFIRM.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.body} lang="en" dir="ltr">
        <p>
          {org.legalName} (“BMCC”, “we”) respects your privacy. This policy explains what personal information this
          website collects, why, who we share it with, how long we keep it, and the choices you have.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Donations and membership dues:</strong> your name, email address, the amount, the fund or purpose,
            and the date. Payments are made on Stripe’s or PayPal’s own secure pages — we never receive or store your
            card number, bank details or PayPal password.
          </li>
          <li>
            <strong>Membership applications:</strong> the names, address, phone number, email and dates of birth of the
            people in your household, and an emergency contact. We use this to administer membership and the Funeral
            Services Benefit.
          </li>
          <li>
            <strong>Your account:</strong> your name and email address. Sign-in is provided by Clerk; we don’t store
            your password.
          </li>
          <li>
            <strong>Mailing list:</strong> your email address and preferred language, and when you confirmed your
            subscription.
          </li>
          <li>
            <strong>Contact form, directory submissions and event RSVPs:</strong> what you send us — for example your
            name, email and message, or a business listing and your email.
          </li>
          <li>
            <strong>Technical information:</strong> your IP address, used briefly to limit spam and abuse (kept for no
            more than a day), and a few cookies that remember your language and keep you signed in. We don’t use
            advertising or cross-site tracking cookies.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To process donations and dues and send receipts and yearly giving statements.</li>
          <li>To administer memberships and the Funeral Services Benefit.</li>
          <li>To reply to your messages and, if you subscribed, send community updates.</li>
          <li>To keep the website secure and prevent spam and fraud.</li>
          <li>To meet our legal and tax obligations as a nonprofit.</li>
        </ul>

        <h2>Who we share it with</h2>
        <p>
          We do not sell or rent your personal information. We share it only with service providers that help us run the
          website, and only what each needs:
        </p>
        <ul>
          <li>Stripe and PayPal — to take payments.</li>
          <li>Clerk — for sign-in.</li>
          <li>Resend — to send emails such as receipts and confirmations.</li>
          <li>Render — hosting for the website and its database.</li>
          <li>Cloudflare — website security and delivery.</li>
          <li>Constant Contact — our newsletter, if you subscribe.</li>
          <li>Google — maps shown on directory listings load from Google Maps.</li>
        </ul>
        <p>We may also disclose information when the law requires it.</p>

        <h2>How long we keep it</h2>
        <ul>
          <li>
            Payment and receipt records: 7 years, for our financial and tax records. If you ask us to delete your data,
            we keep these records without your name or email.
          </li>
          <li>Membership records: while your membership is active, then up to 7 years.</li>
          <li>Mailing list: until you unsubscribe.</li>
          <li>Contact messages: up to 2 years.</li>
        </ul>

        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>See and correct your information:</strong> sign in to <Link href={routes.account}>My account</Link>{" "}
            to see your membership, household and giving history, and to update your contact details.
          </li>
          <li>
            <strong>Unsubscribe:</strong> use the link at the bottom of any newsletter email.
          </li>
          <li>
            <strong>Delete your information:</strong> email us at <a href={`mailto:${org.email}`}>{org.email}</a> or use
            the <Link href={routes.contact}>contact form</Link>. We delete your account, household details, RSVPs,
            mailing-list entry and messages, cancel any recurring payments, and keep payment records only without your
            name or email. We may ask you to confirm the request from the email address we have on file.
          </li>
        </ul>

        <h2>Children</h2>
        <p>
          This website is not directed to children, and we don’t knowingly collect information from children online.
          Parents or guardians may list children as household members on a membership application.
        </p>

        <h2>Security</h2>
        <p>
          The website uses encrypted connections (HTTPS). Card and PayPal details are handled only by Stripe and PayPal.
          Only BMCC staff with the right role can see member and donation records, and their changes are logged.
        </p>

        <h2>Changes</h2>
        <p>If we change this policy, we will update it on this page and change the effective date above.</p>

        <h2>Contact</h2>
        <p>
          {org.legalName}, {org.address} · <a href={`mailto:${org.email}`}>{org.email}</a> · {org.phone}
        </p>
      </div>
    </section>
  );
}
