import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { coverage, COVERAGE_LABEL, type Coverage } from "@/lib/membership/coverage";
import { DUES } from "@/lib/payments/catalog";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Memberships" };

const FILTERS: { id: Coverage | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "covered", label: "Covered" },
  { id: "waiting", label: "Waiting period" },
  { id: "grace", label: "Grace period" },
  { id: "paused", label: "Paused" },
  { id: "not_enrolled", label: "Not paid yet" },
  { id: "canceled", label: "Canceled" },
];

export default async function MembershipsAdmin({ searchParams }: PageProps<"/admin/memberships">) {
  await requireSection("memberships");
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.id === params.status)?.id ?? "all";
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const rows = await db.membership.findMany({
    where: q
      ? {
          OR: [
            { referenceId: { contains: q, mode: "insensitive" } },
            { membershipNumber: { contains: q, mode: "insensitive" } },
            { household: { email: { contains: q, mode: "insensitive" } } },
            { household: { members: { some: { fullName: { contains: q, mode: "insensitive" } } } } },
          ],
        }
      : undefined,
    orderBy: { appliedAt: "desc" },
    include: { household: { include: { members: { orderBy: { createdAt: "asc" } } } } },
  });
  const now = new Date();
  const withCoverage = rows.map((m) => ({ m, cov: coverage(m, now) }));
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id === "all" ? rows.length : withCoverage.filter((x) => x.cov === f.id).length]));
  const shown = filter === "all" ? withCoverage : withCoverage.filter((x) => x.cov === filter);
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Los_Angeles" });

  return (
    <>
      <h1 className={styles.pageTitle}>Memberships</h1>
      <p className={styles.pageLead}>
        Applications become active when the first dues payment goes through. The Funeral Services Benefit starts 6 months
        later; a missed payment gives 30 days of grace before coverage pauses, and paying resumes it.
      </p>
      <form className={styles.row} style={{ marginBottom: 12 }}>
        <input name="q" defaultValue={q} placeholder="Name, email, reference or Membership ID" aria-label="Search memberships" className={styles.input} style={{ width: 340 }} />
        {filter !== "all" && <input type="hidden" name="status" value={filter} />}
        <button type="submit" className={`${styles.btn} ${styles.secondary}`}>
          Search
        </button>
      </form>
      <nav className={styles.tabs} aria-label="Coverage">
        {FILTERS.map((f) => (
          <Link key={f.id} href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(f.id === "all" ? {} : { status: f.id }) })}`} className={`${styles.tab} ${f.id === filter ? styles.tabActive : ""}`}>
            {f.label} ({counts[f.id]})
          </Link>
        ))}
      </nav>
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Primary member</th>
                <th>Reference / ID</th>
                <th>Plan</th>
                <th>Coverage</th>
                <th>Enrolled</th>
                <th>Benefit from</th>
                <th>Household</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ m, cov }) => {
                const primary = m.household.members.find((x) => x.relationship === "SELF") ?? m.household.members[0];
                return (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/admin/memberships/${m.id}`} style={{ fontWeight: 700 }}>
                        {primary?.fullName ?? "—"}
                      </Link>
                      <div className={styles.muted}>{m.household.email}</div>
                    </td>
                    <td>
                      {m.referenceId}
                      <div className={styles.muted}>{m.membershipNumber ?? "ID not assigned"}</div>
                    </td>
                    <td>{DUES[m.plan].label}</td>
                    <td>
                      <span className={`${styles.badge} ${["paused", "grace", "not_enrolled", "canceled"].includes(cov) ? styles.badgeWarn : ""}`}>{COVERAGE_LABEL[cov].split(" — ")[0].split(" (")[0]}</span>
                    </td>
                    <td>{m.enrolledAt ? date.format(m.enrolledAt) : "—"}</td>
                    <td>{m.benefitEligibleFrom ? date.format(m.benefitEligibleFrom) : "—"}</td>
                    <td>{m.household.members.length}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.muted}>
                    None.
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
