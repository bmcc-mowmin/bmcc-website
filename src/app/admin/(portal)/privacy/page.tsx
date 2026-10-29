import type { Metadata } from "next";
import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { previewErase, DELETED_DONOR } from "@/lib/privacy/erase";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { eraseAction } from "./actions";

export const metadata: Metadata = { title: "Privacy requests" };

// Deletion requests ("please delete my data"). Look the person up by email, check what will
// happen, then confirm. See src/lib/privacy/erase.ts for exactly what is deleted vs anonymized.
export default async function PrivacyAdmin({ searchParams }: PageProps<"/admin/privacy">) {
  const admin = await requireSection("privacy");
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.trim().toLowerCase().slice(0, 200) : "";
  const p = email ? await previewErase(email, admin.id) : null;

  const rows: [string, string | number, "delete" | "anonymize" | "clear" | "cancel"][] = p
    ? [
        ["Account (sign-in, name)", p.account ? "yes" : "none", "delete"],
        ["Clerk sign-in account", p.signInAccount ? "yes" : "none", "delete"],
        ["Household members (names, birth dates)", p.householdMembers, "delete"],
        ["Household address, phone, emergency contact", p.households, "clear"],
        ["Memberships", p.memberships, "cancel"],
        ["Active monthly gifts / dues subscriptions", p.activeSubscriptions, "cancel"],
        ["Payments and receipts", p.payments, "anonymize"],
        ["Checkouts started", p.checkouts, "clear"],
        ["Event RSVPs", p.rsvps, "delete"],
        ["Mailing-list entry", p.subscriber ? "yes" : "none", "delete"],
        ["Contact-form messages", p.messages, "delete"],
        ["Directory listings they submitted (submitter email)", p.submittedListings, "clear"],
      ]
    : [];
  const what = { delete: "Deleted", anonymize: "Kept without name/email", clear: "Name/contact details removed", cancel: "Cancelled" };

  return (
    <>
      <h1 className={styles.pageTitle}>Privacy requests</h1>
      <p className={styles.pageLead}>
        When someone asks BMCC to delete their data. Their account, household members, RSVPs, mailing-list entry and
        messages are deleted. Payments and receipts are kept for BMCC&apos;s financial records but no longer show who
        paid: the name becomes “{DELETED_DONOR}”. Active monthly gifts and dues are cancelled first. The activity log
        records that an erasure happened, not the email.
      </p>

      <form method="get" className={styles.card}>
        <h2 className={styles.cardTitle}>Find a person</h2>
        <div className={styles.row}>
          <div className={styles.field} style={{ flex: 1, minWidth: 260 }}>
            <label htmlFor="pr-email" className={styles.label}>
              Email address
            </label>
            <input id="pr-email" name="email" type="email" required defaultValue={email} className={styles.input} />
          </div>
          <button type="submit" className={`${styles.btn} ${styles.secondary}`}>
            Look up
          </button>
        </div>
      </form>

      {p && !p.found && <p className={styles.notice}>Nothing is stored for {p.email}.</p>}

      {p?.found && (
        <section className={styles.card} aria-labelledby="pr-preview">
          <h2 id="pr-preview" className={styles.cardTitle}>
            What will happen for {p.email}
          </h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Found</th>
                <th>On erase</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, count, action]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{count}</td>
                  <td>{count === 0 || count === "none" ? <span className={styles.muted}>—</span> : what[action]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(p.listingsWithEmail.length > 0 || p.otherHouseholds > 0) && (
            <div className={styles.notice} style={{ marginTop: 16 }}>
              <strong>Not changed automatically — review by hand:</strong>
              <ul>
                {p.listingsWithEmail.map((l) => (
                  <li key={l.id}>
                    Directory listing <Link href={`/admin/directory/${l.id}`}>{l.name}</Link> shows this email publicly.
                  </li>
                ))}
                {p.otherHouseholds > 0 && <li>Listed as a member of {p.otherHouseholds} other household(s) — that household&apos;s primary member or the office decides.</li>}
              </ul>
            </div>
          )}

          {p.blockedReason ? (
            <p className={styles.err} role="alert" style={{ marginTop: 16 }}>
              {p.blockedReason}
            </p>
          ) : (
            <ActionForm action={eraseAction} submitLabel="Erase this person" variant="danger" confirm={`Erase ${p.email}? This can't be undone.`}>
              <input type="hidden" name="email" value={p.email} />
              <div className={styles.field} style={{ marginTop: 16, maxWidth: 420 }}>
                <label htmlFor="pr-confirm" className={styles.label}>
                  Type the email address to confirm
                </label>
                <input id="pr-confirm" name="confirm" type="email" autoComplete="off" required className={styles.input} />
              </div>
            </ActionForm>
          )}
        </section>
      )}
    </>
  );
}
