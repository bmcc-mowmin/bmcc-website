import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { coverage, COVERAGE_LABEL } from "@/lib/membership/coverage";
import { DUES, usd } from "@/lib/payments/catalog";
import { isMockPayments } from "@/lib/payments/provider";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import {
  cancelMembership,
  removeHouseholdMember,
  saveHouseholdMember,
  saveMembershipAdmin,
  simulateFailedPayment,
  simulateGraceExpired,
  simulateRenewal,
} from "../actions";

export const metadata: Metadata = { title: "Membership" };

const RELATIONSHIPS = ["SELF", "SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"] as const;
const rel = (r: string) => (r === "SELF" ? "Primary member" : r.charAt(0) + r.slice(1).toLowerCase());

export default async function MembershipDetail({ params }: PageProps<"/admin/memberships/[id]">) {
  await requireSection("memberships");
  const { id } = await params;
  const m = await db.membership.findUnique({
    where: { id },
    include: {
      household: { include: { members: { orderBy: { createdAt: "asc" } } } },
      payments: { orderBy: { paidAt: "desc" } },
      subscriptions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!m) notFound();
  const cov = coverage(m);
  const h = m.household;
  const primary = h.members.find((x) => x.relationship === "SELF") ?? h.members[0];
  const sub = m.subscriptions[0];
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Los_Angeles" });
  const d = (v: Date | null) => (v ? date.format(v) : "—");
  const iso = (v: Date | null) => (v ? v.toISOString().slice(0, 10) : "");

  return (
    <>
      <Link href="/admin/memberships">← Memberships</Link>
      <div className={styles.monthNav} style={{ marginTop: 10, flexWrap: "wrap" }}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>
          {primary?.fullName}
        </h1>
        <span className={`${styles.badge} ${["paused", "grace", "not_enrolled", "canceled"].includes(cov) ? styles.badgeWarn : ""}`}>{COVERAGE_LABEL[cov]}</span>
      </div>
      <p className={styles.pageLead}>
        Reference {m.referenceId} · {DUES[m.plan].label} · applied {d(m.appliedAt)}
      </p>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Benefit &amp; dues</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "6px 14px", fontSize: 14, margin: "8px 0 16px" }}>
          <dt className={styles.muted}>Status</dt>
          <dd style={{ margin: 0 }}>{m.status.replace("_", " ").toLowerCase()}</dd>
          <dt className={styles.muted}>Enrolled (first payment)</dt>
          <dd style={{ margin: 0 }}>{d(m.enrolledAt)}</dd>
          <dt className={styles.muted}>Funeral benefit available from</dt>
          <dd style={{ margin: 0 }}>{d(m.benefitEligibleFrom)}</dd>
          {m.graceEndsAt && (
            <>
              <dt className={styles.muted}>Grace period ends</dt>
              <dd style={{ margin: 0 }}>{d(m.graceEndsAt)}</dd>
            </>
          )}
          {sub && (
            <>
              <dt className={styles.muted}>Next dues date</dt>
              <dd style={{ margin: 0 }}>
                {sub.status === "CANCELED" ? "— (subscription canceled)" : d(sub.currentPeriodEnd)} · {sub.provider} subscription {sub.status.toLowerCase().replace("_", " ")}
              </dd>
            </>
          )}
        </dl>
        <ActionForm action={saveMembershipAdmin} submitLabel="Save">
          <input type="hidden" name="id" value={m.id} />
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="mid">
                Membership ID (assigned by the office)
              </label>
              <input id="mid" name="membershipNumber" defaultValue={m.membershipNumber ?? ""} className={styles.input} style={{ width: 200 }} />
            </div>
            <div className={styles.field} style={{ flex: 1, minWidth: 260 }}>
              <label className={styles.label} htmlFor="notes">
                Internal notes
              </label>
              <textarea id="notes" name="notes" rows={2} defaultValue={m.notes ?? ""} className={styles.input} />
            </div>
          </div>
        </ActionForm>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Household — covered by the Funeral Services Benefit</h2>
        <p className={styles.cardLead}>
          {h.addressLine1}, {h.city}, {h.state} {h.zip} · {h.phone} · {h.email}
          {h.emergencyName && ` · Emergency: ${h.emergencyName} ${h.emergencyPhone}`}
        </p>
        {h.members.map((p) => (
          <div key={p.id} className={styles.row} style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 10, alignItems: "flex-end" }}>
            <ActionForm action={saveHouseholdMember} submitLabel="Save">
              <input type="hidden" name="membershipId" value={m.id} />
              <input type="hidden" name="memberId" value={p.id} />
              <div className={styles.row}>
                <input name="fullName" defaultValue={p.fullName} aria-label="Full name" className={styles.input} style={{ width: 220 }} />
                {p.relationship === "SELF" ? (
                  <>
                    <input type="hidden" name="relationship" value="SELF" />
                    <span className={styles.badge}>Primary member</span>
                  </>
                ) : (
                  <select name="relationship" defaultValue={p.relationship} aria-label="Relationship" className={styles.select}>
                    {RELATIONSHIPS.filter((r) => r !== "SELF").map((r) => (
                      <option key={r} value={r}>
                        {rel(r)}
                      </option>
                    ))}
                  </select>
                )}
                <input name="dateOfBirth" type="date" defaultValue={iso(p.dateOfBirth)} aria-label="Date of birth" className={styles.input} />
              </div>
            </ActionForm>
            {p.relationship !== "SELF" && (
              <ActionForm action={removeHouseholdMember} submitLabel="Remove" variant="danger" confirm={`Remove ${p.fullName}? They will no longer be covered.`}>
                <input type="hidden" name="membershipId" value={m.id} />
                <input type="hidden" name="memberId" value={p.id} />
              </ActionForm>
            )}
          </div>
        ))}
        <details style={{ marginTop: 14 }}>
          <summary className={styles.label} style={{ cursor: "pointer" }}>
            + Add a household member
          </summary>
          <ActionForm action={saveHouseholdMember} submitLabel="Add" resetOnSuccess>
            <input type="hidden" name="membershipId" value={m.id} />
            <div className={styles.row} style={{ marginTop: 8 }}>
              <input name="fullName" placeholder="Full name" aria-label="Full name" required className={styles.input} style={{ width: 220 }} />
              <select name="relationship" aria-label="Relationship" className={styles.select}>
                {RELATIONSHIPS.filter((r) => r !== "SELF").map((r) => (
                  <option key={r} value={r}>
                    {rel(r)}
                  </option>
                ))}
              </select>
              <input name="dateOfBirth" type="date" aria-label="Date of birth" className={styles.input} />
            </div>
          </ActionForm>
        </details>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Payments</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {m.payments.map((p) => (
                <tr key={p.id}>
                  <td>{d(p.paidAt)}</td>
                  <td>{p.receiptNumber}</td>
                  <td>{usd(p.amountCents)}</td>
                  <td>{p.status.toLowerCase()}</td>
                </tr>
              ))}
              {m.payments.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.muted}>
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isMockPayments() && sub && sub.status !== "CANCELED" && (
        <section className={styles.card} style={{ borderStyle: "dashed" }}>
          <h2 className={styles.cardTitle}>Test tools (mock payments only)</h2>
          <p className={styles.cardLead}>Stand in for what the payment provider does on its own schedule, so renewals and the grace period can be tested.</p>
          <div className={styles.row} style={{ gap: 16 }}>
            <ActionForm action={simulateRenewal} submitLabel="Next payment succeeds" variant="secondary">
              <input type="hidden" name="subscriptionId" value={sub.id} />
            </ActionForm>
            <ActionForm action={simulateFailedPayment} submitLabel="Next payment fails" variant="secondary">
              <input type="hidden" name="subscriptionId" value={sub.id} />
            </ActionForm>
            {m.status === "PAST_DUE" && (
              <ActionForm action={simulateGraceExpired} submitLabel="Grace period ends now" variant="secondary">
                <input type="hidden" name="subscriptionId" value={sub.id} />
              </ActionForm>
            )}
          </div>
        </section>
      )}

      {m.status !== "CANCELLED" && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Cancel membership</h2>
          <p className={styles.cardLead}>Stops future dues. Coverage ends; the household record and payment history are kept.</p>
          <ActionForm action={cancelMembership} submitLabel="Cancel membership" variant="danger" confirm="Cancel this membership and stop future dues?">
            <input type="hidden" name="id" value={m.id} />
          </ActionForm>
        </section>
      )}
    </>
  );
}
