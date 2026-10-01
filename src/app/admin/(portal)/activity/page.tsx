import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { masjidClock } from "@/lib/prayer/schedule";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Activity log" };

const PAGE_SIZE = 50;

export default async function ActivityLog({ searchParams }: PageProps<"/admin/activity">) {
  await requireSection("activity");
  const params = await searchParams;
  const actor = typeof params.actor === "string" ? params.actor : "";
  const entity = typeof params.entity === "string" ? params.entity : "";
  const page = Math.max(1, Number(params.page) || 1);

  const where = { ...(actor ? { actorId: actor } : {}), ...(entity ? { entity } : {}) };
  const [rows, total, actors, entities, { timeZone }] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { email: true, name: true } } },
    }),
    db.auditLog.count({ where }),
    db.user.findMany({ where: { auditLogs: { some: {} } }, select: { id: true, email: true, name: true }, orderBy: { email: "asc" } }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    masjidClock(),
  ]);
  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `?${new URLSearchParams({ ...(actor ? { actor } : {}), ...(entity ? { entity } : {}), page: String(p) })}`;

  return (
    <>
      <h1 className={styles.pageTitle}>Activity log</h1>
      <p className={styles.pageLead}>Every change made in the admin portal: who, what and when. Entries can&apos;t be edited or deleted.</p>

      <form className={styles.row} style={{ marginBottom: 14 }}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="f-actor">
            Person
          </label>
          <select id="f-actor" name="actor" defaultValue={actor} className={styles.select}>
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.email}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="f-entity">
            What
          </label>
          <select id="f-entity" name="entity" defaultValue={entity} className={styles.select}>
            <option value="">Everything</option>
            {entities.map((e) => (
              <option key={e.entity} value={e.entity}>
                {e.entity}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <button type="submit" className={`${styles.btn} ${styles.secondary}`}>
            Filter
          </button>
        </div>
      </form>

      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Item</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{when.format(r.createdAt)}</td>
                  <td>{r.actor?.name ?? r.actor?.email ?? "System"}</td>
                  <td>{r.action.replace(/_/g, " ")}</td>
                  <td>
                    {r.entity} <span className={styles.muted}>{r.entityId.slice(0, 12)}</span>
                  </td>
                  <td style={{ whiteSpace: "normal" }}>
                    {r.diff ? (
                      <details>
                        <summary>View</summary>
                        <pre className={styles.diff}>{JSON.stringify(r.diff, null, 2)}</pre>
                      </details>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.pager}>
          {page > 1 && <Link href={link(page - 1)}>← Newer</Link>}
          <span className={styles.muted}>
            Page {page} of {pages} · {total} entries
          </span>
          {page < pages && <Link href={link(page + 1)}>Older →</Link>}
        </div>
      </section>
    </>
  );
}
