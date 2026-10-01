import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { can, NAV, type Section } from "@/lib/auth/permissions";
import { getTodayAndTomorrow, masjidClock } from "@/lib/prayer/schedule";
import { getPrayerSourceStatus } from "@/lib/prayer/sources";
import { masjidNow, nextPrayer, formatClock } from "@/lib/prayer/next-prayer";
import { getUpcomingEvents } from "@/lib/events";
import { zonedToUtc } from "@/lib/time";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Dashboard" };

type Stat = { section: Section; value: string; label: string; alert?: boolean };

const builtHref = (section: Section) => NAV.find((n) => n.section === section && n.built)?.href;

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const user = await requireSection("dashboard");
  const { denied, welcome } = await searchParams;
  const roles = user.adminRoles;
  const now = new Date();
  const { date, timeZone } = await masjidClock();
  const monthStart = zonedToUtc(`${date.slice(0, 7)}-01`, "00:00", timeZone);

  const stats: Stat[] = [];
  if (can(roles, "prayer")) {
    const [{ today, tomorrow }, source] = await Promise.all([getTodayAndTomorrow(), getPrayerSourceStatus()]);
    const np = nextPrayer(today, tomorrow, masjidNow(timeZone).minutes);
    const name = np.key.charAt(0).toUpperCase() + np.key.slice(1);
    stats.push({ section: "prayer", value: `${name} ${formatClock(np.time, "en-US")}`, label: `Next prayer${np.tomorrow ? " (tomorrow)" : ""} · source: ${source.label}`, alert: !source.ok });
  }
  if (can(roles, "events")) {
    const upcoming = await getUpcomingEvents("en");
    stats.push({ section: "events", value: String(upcoming.length), label: upcoming[0] ? `Upcoming events · next: ${upcoming[0].title}` : "Upcoming events" });
  }
  if (can(roles, "announcements")) {
    const live = await db.announcement.count({ where: { active: true, startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gt: now } }] } });
    stats.push({ section: "announcements", value: String(live), label: "Announcements showing now" });
  }
  if (can(roles, "directory")) {
    const pending = await db.directoryListing.count({ where: { status: "PENDING" } });
    stats.push({ section: "directory", value: String(pending), label: "Directory listings awaiting approval", alert: pending > 0 });
  }
  if (can(roles, "memberships")) {
    const [active, fresh] = await Promise.all([
      db.membership.count({ where: { status: "ACTIVE" } }),
      db.membership.count({ where: { appliedAt: { gte: monthStart } } }),
    ]);
    stats.push({ section: "memberships", value: String(active), label: `Active memberships · ${fresh} new this month` });
  }
  if (can(roles, "donations")) {
    const sum = await db.payment.aggregate({ _sum: { amountCents: true }, where: { kind: "DONATION", status: "SUCCEEDED", paidAt: { gte: monthStart } } });
    stats.push({ section: "donations", value: `$${((sum._sum.amountCents ?? 0) / 100).toLocaleString("en-US")}`, label: "Donations this month" });
  }
  if (can(roles, "messages")) {
    const unread = await db.contactMessage.count({ where: { status: "NEW" } });
    stats.push({ section: "messages", value: String(unread), label: "New contact messages", alert: unread > 0 });
  }
  if (can(roles, "subscribers")) {
    const confirmed = await db.subscriber.count({ where: { status: "CONFIRMED" } });
    stats.push({ section: "subscribers", value: String(confirmed), label: "Confirmed mailing-list subscribers" });
  }

  const activity = can(roles, "activity")
    ? await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { email: true, name: true } } } })
    : [];
  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone });

  return (
    <>
      <h1 className={styles.pageTitle}>Assalamu alaikum{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
      <p className={styles.pageLead}>Here&apos;s what needs attention. You see the sections your roles allow.</p>
      {denied && <p className={styles.notice}>You don&apos;t have access to that section. Ask a Super admin if you need it.</p>}
      {welcome && <p className={styles.notice} style={{ background: "var(--success-bg)", color: "var(--success)" }}>Your password is set — welcome to the BMCC admin portal.</p>}

      <div className={styles.stats}>
        {stats.map((s) => {
          const href = builtHref(s.section);
          const body = (
            <>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </>
          );
          return href ? (
            <Link key={s.section} href={href} className={`${styles.stat} ${s.alert ? styles.statAlert : ""}`}>
              {body}
            </Link>
          ) : (
            <div key={s.section} className={`${styles.stat} ${s.alert ? styles.statAlert : ""}`}>
              {body}
            </div>
          );
        })}
      </div>

      {activity.length > 0 && (
        <section className={styles.card}>
          <div className={styles.monthNav}>
            <h2 className={styles.cardTitle} style={{ margin: 0 }}>
              Recent activity
            </h2>
            <Link href="/admin/activity" style={{ marginInlineStart: "auto", fontSize: 14 }}>
              Full log →
            </Link>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td className={styles.muted}>{when.format(a.createdAt)}</td>
                    <td>{a.actor?.name ?? a.actor?.email ?? "System"}</td>
                    <td>
                      {a.action.replace(/_/g, " ")} <strong>{a.entity}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
