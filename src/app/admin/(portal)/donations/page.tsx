import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { masjidClock } from "@/lib/prayer/schedule";
import { zonedToUtc } from "@/lib/time";
import { FUND_LABELS, FUNDS, isFund, usd } from "@/lib/payments/catalog";
import { isMockPayments } from "@/lib/payments/provider";
import { filterQuery, paymentWhere, readFilters } from "@/lib/payments/report";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { simulateFailedPayment, simulateRenewal } from "../memberships/actions";

export const metadata: Metadata = { title: "Donations" };

const PAGE = 100;

export default async function DonationsAdmin({ searchParams }: PageProps<"/admin/donations">) {
  const user = await requireSection("donations");
  const f = readFilters(await searchParams);
  const { date, timeZone } = await masjidClock();
  const monthStart = zonedToUtc(`${date.slice(0, 7)}-01`, "00:00", timeZone);
  const yearStart = zonedToUtc(`${date.slice(0, 4)}-01-01`, "00:00", timeZone);
  const where = paymentWhere(f, timeZone);

  const [rows, filteredSum, month, year, byFund, recurring] = await Promise.all([
    db.payment.findMany({ where, orderBy: { paidAt: "desc" }, take: PAGE }),
    db.payment.aggregate({ where, _sum: { amountCents: true }, _count: true }),
    db.payment.aggregate({ where: { status: "SUCCEEDED", kind: "DONATION", paidAt: { gte: monthStart } }, _sum: { amountCents: true } }),
    db.payment.aggregate({ where: { status: "SUCCEEDED", kind: "DONATION", paidAt: { gte: yearStart } }, _sum: { amountCents: true } }),
    db.payment.groupBy({ by: ["fund"], where: { status: "SUCCEEDED", kind: "DONATION", paidAt: { gte: yearStart } }, _sum: { amountCents: true } }),
    db.subscription.findMany({ where: { kind: "DONATION" }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
  ]);
  const activeMonthly = recurring.filter((s) => s.status === "ACTIVE");
  const monthlyRecurring = activeMonthly.reduce((sum, s) => sum + (s.interval === "MONTH" ? s.amountCents : Math.round(s.amountCents / 12)), 0);
  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone });
  const canSimulate = isMockPayments() && can(user.adminRoles, "settings");
  const qs = filterQuery(f);

  return (
    <>
      <div className={styles.monthNav}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>
          Donations
        </h1>
        <a href={`/admin/donations/export${qs ? `?${qs}` : ""}`} download className={`${styles.btn} ${styles.secondary}`} style={{ marginInlineStart: "auto" }}>
          Export CSV
        </a>
      </div>
      <p className={styles.pageLead}>
        Read-only: every successful payment as recorded from the payment provider{isMockPayments() ? " (currently the TEST provider — no real money)" : ""}.
        Refunds and payouts are handled in the provider&apos;s dashboard.
      </p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{usd(month._sum.amountCents ?? 0)}</div>
          <div className={styles.statLabel}>Donations this month</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{usd(year._sum.amountCents ?? 0)}</div>
          <div className={styles.statLabel}>Donations this year</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{activeMonthly.length}</div>
          <div className={styles.statLabel}>Active recurring donors · {usd(monthlyRecurring)}/month</div>
        </div>
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>This year by fund</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <tbody>
              {FUNDS.map((fund) => (
                <tr key={fund.id}>
                  <td>{FUND_LABELS[fund.id]}</td>
                  <td style={{ textAlign: "end", fontWeight: 700 }}>{usd(byFund.find((b) => b.fund === fund.id)?._sum.amountCents ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Payments</h2>
        <form className={styles.row} style={{ marginBottom: 12 }}>
          <select name="kind" defaultValue={f.kind} aria-label="Type" className={styles.select}>
            <option value="">Donations and dues</option>
            <option value="DONATION">Donations</option>
            <option value="DUES">Membership dues</option>
          </select>
          <select name="fund" defaultValue={f.fund} aria-label="Fund" className={styles.select}>
            <option value="">All funds</option>
            {FUNDS.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {FUND_LABELS[fund.id]}
              </option>
            ))}
          </select>
          <input type="date" name="from" defaultValue={f.from} aria-label="From" className={styles.input} />
          <input type="date" name="to" defaultValue={f.to} aria-label="To" className={styles.input} />
          <input name="q" defaultValue={f.q} placeholder="Name, email or receipt" aria-label="Search" className={styles.input} />
          <button type="submit" className={`${styles.btn} ${styles.secondary}`}>
            Filter
          </button>
          {qs && <Link href="/admin/donations">Clear</Link>}
        </form>
        <p className={styles.cardLead}>
          {filteredSum._count} payment{filteredSum._count === 1 ? "" : "s"} · {usd(filteredSum._sum.amountCents ?? 0)}
          {filteredSum._count > PAGE ? ` · showing the latest ${PAGE} (export for all)` : ""}
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt</th>
                <th>From</th>
                <th>For</th>
                <th>Frequency</th>
                <th style={{ textAlign: "end" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.paidAt ? when.format(p.paidAt) : "—"}</td>
                  <td>{p.receiptNumber}</td>
                  <td>
                    {p.donorName ?? "—"}
                    <div className={styles.muted}>{p.donorEmail}</div>
                  </td>
                  <td>{p.kind === "DUES" ? "Membership dues" : isFund(p.fund) ? FUND_LABELS[p.fund] : "—"}</td>
                  <td>{p.frequency.toLowerCase().replace("_", "-")}</td>
                  <td style={{ textAlign: "end", fontWeight: 700 }}>{usd(p.amountCents)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.muted}>
                    No payments match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Recurring donations</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Donor</th>
                <th>Fund</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Next charge</th>
                {canSimulate && <th>Test tools</th>}
              </tr>
            </thead>
            <tbody>
              {recurring.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name ?? "—"}
                    <div className={styles.muted}>{s.email}</div>
                  </td>
                  <td>{isFund(s.fund) ? FUND_LABELS[s.fund] : "—"}</td>
                  <td>
                    {usd(s.amountCents)}/{s.interval === "MONTH" ? "month" : "year"}
                  </td>
                  <td>{s.status.toLowerCase().replace("_", " ")}</td>
                  <td>{s.status === "CANCELED" ? "—" : when.format(s.currentPeriodEnd)}</td>
                  {canSimulate && (
                    <td>
                      {s.status !== "CANCELED" && (
                        <div className={styles.row} style={{ gap: 8 }}>
                          <ActionForm action={simulateRenewal} submitLabel="Renew" variant="secondary">
                            <input type="hidden" name="subscriptionId" value={s.id} />
                          </ActionForm>
                          <ActionForm action={simulateFailedPayment} submitLabel="Fail" variant="secondary">
                            <input type="hidden" name="subscriptionId" value={s.id} />
                          </ActionForm>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {recurring.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.muted}>
                    No recurring donations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
