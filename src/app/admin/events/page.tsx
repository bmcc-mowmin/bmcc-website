import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { localize } from "@/lib/i18n/dictionary";
import { masjidClock } from "@/lib/prayer/schedule";
import { upcomingOccurrences, weeklyDay } from "@/lib/events/recurrence";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Events" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function EventsAdmin({ searchParams }: PageProps<"/admin/events">) {
  const { status } = await searchParams;
  const [rows, { timeZone }] = await Promise.all([db.event.findMany({ orderBy: { startAt: "desc" } }), masjidClock()]);
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  const items = rows
    .map((r) => ({ row: r, next: upcomingOccurrences(r, timeZone, now, 1)[0] }))
    .sort((a, b) => (a.next ? a.next.start.getTime() : Infinity) - (b.next ? b.next.start.getTime() : Infinity));

  return (
    <>
      <div className={styles.monthNav}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>
          Events
        </h1>
        <Link href="/admin/events/new" className={`${styles.btn} ${styles.primary}`} style={{ marginInlineStart: "auto" }}>
          + New event
        </Link>
      </div>
      <p className={styles.pageLead}>
        Published upcoming events appear on the Events page, and the next 8 in the Home carousel. Past one-off events stay
        here (and keep their page) but drop off the site&apos;s lists.
      </p>
      {status === "deleted" && (
        <p role="status" className={styles.ok}>
          Event deleted.
        </p>
      )}
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Event</th>
                <th>Next</th>
                <th>Repeats</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ row, next }) => {
                const day = weeklyDay(row.rrule);
                return (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/events/${row.id}`} style={{ fontWeight: 700 }}>
                        {localize(row.title, "en")}
                      </Link>
                      <div className={styles.muted}>/events/{row.slug}</div>
                    </td>
                    <td>{next ? fmt.format(next.start) : <span className={styles.muted}>finished</span>}</td>
                    <td>{day !== null ? `Every ${WEEKDAYS[day]}` : "—"}</td>
                    <td>{row.published ? <span className={styles.badge}>Published</span> : <span className={`${styles.badge} ${styles.badgeWarn}`}>Hidden</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
