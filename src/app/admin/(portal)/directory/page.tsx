import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { masjidClock } from "@/lib/prayer/schedule";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { approveListing, importListings, rejectListing } from "./actions";

export const metadata: Metadata = { title: "Directory" };

const TABS = [
  { status: "PENDING", label: "Waiting for review" },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
] as const;

export default async function DirectoryAdmin({ searchParams }: PageProps<"/admin/directory">) {
  await requireSection("directory");
  const params = await searchParams;
  const status = TABS.find((t) => t.status === params.status)?.status ?? "PENDING";
  const [rows, counts, { timeZone }] = await Promise.all([
    db.directoryListing.findMany({ where: { status }, orderBy: status === "PENDING" ? { createdAt: "asc" } : { name: "asc" }, include: { reviewedBy: { select: { email: true, name: true } } } }),
    db.directoryListing.groupBy({ by: ["status"], _count: true }),
    masjidClock(),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone });

  return (
    <>
      <div className={styles.monthNav}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>
          Community Directory
        </h1>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 10 }}>
          <a href="/admin/directory/export" download className={`${styles.btn} ${styles.secondary}`}>
            Export CSV
          </a>
          <Link href="/admin/directory/new" className={`${styles.btn} ${styles.primary}`}>
            + New listing
          </Link>
        </span>
      </div>
      <p className={styles.pageLead}>
        Submissions from the public form wait here until someone approves them; only approved listings appear on the site.
        Approving or rejecting emails the person who submitted it.
      </p>
      {params.deleted && <p className={styles.ok}>Listing deleted.</p>}

      <nav className={styles.tabs} aria-label="Listing status">
        {TABS.map((t) => (
          <Link key={t.status} href={`?status=${t.status}`} className={`${styles.tab} ${t.status === status ? styles.tabActive : ""}`} aria-current={t.status === status ? "page" : undefined}>
            {t.label} ({count(t.status)})
          </Link>
        ))}
      </nav>

      {status === "PENDING" &&
        (rows.length === 0 ? (
          <section className={styles.card}>
            <p className={styles.muted} style={{ margin: 0 }}>
              Nothing waiting for review.
            </p>
          </section>
        ) : (
          rows.map((l) => (
            <section key={l.id} className={styles.card} aria-label={l.name}>
              <div className={styles.monthNav} style={{ flexWrap: "wrap" }}>
                <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                  {l.name}
                </h2>
                <span className={styles.badge}>{l.listingType === "BUSINESS" ? "Business" : "Individual"}</span>
                <span className={styles.muted} style={{ marginInlineStart: "auto", fontSize: 13 }}>
                  Submitted {when.format(l.createdAt)}
                  {l.submitterEmail ? ` by ${l.submitterEmail}` : ""}
                </span>
              </div>
              <dl style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "6px 14px", fontSize: 14, margin: "4px 0 14px" }}>
                <dt className={styles.muted}>Category</dt>
                <dd style={{ margin: 0 }}>
                  {l.parentCategory} / {l.category}
                </dd>
                <dt className={styles.muted}>Description</dt>
                <dd style={{ margin: 0, whiteSpace: "pre-line" }}>{l.description}</dd>
                {l.tags.length > 0 && (
                  <>
                    <dt className={styles.muted}>Tags</dt>
                    <dd style={{ margin: 0 }}>{l.tags.join(", ")}</dd>
                  </>
                )}
                <dt className={styles.muted}>Contact</dt>
                <dd style={{ margin: 0 }}>{[l.author, l.phone, l.email, l.website].filter(Boolean).join(" · ")}</dd>
                <dt className={styles.muted}>Location</dt>
                <dd style={{ margin: 0 }}>{[l.address, l.city, l.state, l.zip].filter(Boolean).join(", ") || <span className={styles.muted}>none — no map will be shown</span>}</dd>
              </dl>
              <div className={styles.row} style={{ gap: 16, alignItems: "flex-start" }}>
                <ActionForm action={approveListing} submitLabel="Approve">
                  <input type="hidden" name="id" value={l.id} />
                </ActionForm>
                <Link href={`/admin/directory/${l.id}`} className={`${styles.btn} ${styles.secondary}`} style={{ marginTop: 6 }}>
                  Edit first
                </Link>
                <details style={{ marginTop: 10 }}>
                  <summary className={styles.label} style={{ cursor: "pointer" }}>
                    Reject…
                  </summary>
                  <ActionForm action={rejectListing} submitLabel="Reject" variant="danger">
                    <input type="hidden" name="id" value={l.id} />
                    <div className={styles.field} style={{ marginTop: 8 }}>
                      <label className={styles.label} htmlFor={`reason-${l.id}`}>
                        Reason (optional, included in the email)
                      </label>
                      <input id={`reason-${l.id}`} name="reason" className={styles.input} style={{ width: 360 }} maxLength={500} />
                    </div>
                    <label style={{ display: "flex", gap: 6, fontSize: 14 }}>
                      <input type="checkbox" name="notify" defaultChecked={!!l.submitterEmail} disabled={!l.submitterEmail} /> Email the submitter
                    </label>
                  </ActionForm>
                </details>
              </div>
            </section>
          ))
        ))}

      {status !== "PENDING" && (
        <section className={styles.card}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>City</th>
                  <th>Phone</th>
                  <th>Reviewed</th>
                  {status === "REJECTED" && <th>Reason</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/admin/directory/${l.id}`} style={{ fontWeight: 700 }}>
                        {l.name}
                      </Link>
                    </td>
                    <td>
                      {l.parentCategory} / {l.category}
                    </td>
                    <td>{l.city ?? <span className={styles.muted}>—</span>}</td>
                    <td>{l.phone ?? <span className={styles.muted}>—</span>}</td>
                    <td className={styles.muted}>{l.reviewedAt ? `${when.format(l.reviewedAt)}${l.reviewedBy ? ` · ${l.reviewedBy.name ?? l.reviewedBy.email}` : ""}` : "—"}</td>
                    {status === "REJECTED" && <td style={{ whiteSpace: "normal" }}>{l.rejectionReason ?? "—"}</td>}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.muted}>
                      None.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Import listings from a CSV</h2>
        <p className={styles.cardLead}>
          For restoring the vetted listings (e.g. exported from Google Sheets as CSV). The first row must be column headers;
          recognized columns: <em>name, listing type, main category, category, tags, description, author, phone, email,
          website, address, city, state, zip, google map url</em>. Rows with the same name and phone as an existing listing
          are skipped, so an import can be repeated safely. Use “Export CSV” to see the exact format.
        </p>
        <ActionForm action={importListings} submitLabel="Import" resetOnSuccess>
          <div className={styles.row}>
            <input type="file" name="file" accept=".csv,text/csv" required aria-label="CSV file" />
            <label style={{ display: "flex", gap: 6, fontSize: 14 }}>
              <input type="checkbox" name="asPending" /> Import as “waiting for review” instead of approved
            </label>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
