import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { masjidClock } from "@/lib/prayer/schedule";
import styles from "@/components/admin/admin.module.css";
import { topicLabel } from "./topic";

export const metadata: Metadata = { title: "Messages" };

const PAGE = 50;
const TABS = [
  { status: "NEW", label: "New" },
  { status: "HANDLED", label: "Handled" },
] as const;

export default async function MessagesAdmin({ searchParams }: PageProps<"/admin/messages">) {
  await requireSection("messages");
  const params = await searchParams;
  const status = TABS.find((t) => t.status === params.status)?.status ?? "NEW";
  const page = Math.max(1, Number(params.page) || 1);
  const [rows, counts, { timeZone }] = await Promise.all([
    db.contactMessage.findMany({ where: { status }, orderBy: { createdAt: status === "NEW" ? "asc" : "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    db.contactMessage.groupBy({ by: ["status"], _count: true }),
    masjidClock(),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(count(status) / PAGE));
  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone });

  return (
    <>
      <h1 className={styles.pageTitle}>Messages</h1>
      <p className={styles.pageLead}>
        Everything sent with the website’s contact form. Each message is also emailed to the office inbox — reply from
        there (or with “Reply by email” here), then mark it handled so others know it’s been answered.
      </p>
      {params.deleted && <p className={styles.ok}>Message deleted.</p>}
      <nav className={styles.tabs} aria-label="Message status">
        {TABS.map((t) => (
          <Link key={t.status} href={`?status=${t.status}`} className={`${styles.tab} ${t.status === status ? styles.tabActive : ""}`} aria-current={t.status === status ? "page" : undefined}>
            {t.label} ({count(t.status)})
          </Link>
        ))}
      </nav>
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Received</th>
                <th>From</th>
                <th>About</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className={styles.muted}>{when.format(m.createdAt)}</td>
                  <td>
                    <Link href={`/admin/messages/${m.id}`} style={{ fontWeight: 700 }}>
                      {m.name}
                    </Link>
                    <div className={styles.muted} style={{ fontSize: 13 }}>
                      {m.email}
                    </div>
                  </td>
                  <td>{topicLabel(m.topic)}</td>
                  <td style={{ whiteSpace: "normal", maxWidth: 420 }}>{m.message.length > 140 ? `${m.message.slice(0, 140)}…` : m.message}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.muted}>
                    {status === "NEW" ? "No new messages." : "None."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className={styles.pager}>
            {page > 1 && <Link href={`?status=${status}&page=${page - 1}`}>← Previous</Link>}
            <span className={styles.muted}>
              Page {page} of {pages}
            </span>
            {page < pages && <Link href={`?status=${status}&page=${page + 1}`}>Next →</Link>}
          </div>
        )}
      </section>
    </>
  );
}
