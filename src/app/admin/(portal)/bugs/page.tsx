import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { masjidClock } from "@/lib/prayer/schedule";
import type { Prisma } from "@/generated/prisma/client";
import { AREAS, areaLabel, bugRef, CLOSED_STATUSES, isArea, isOverdue, isPriority, parseBugRef, PRIORITIES, statusLabel } from "@/lib/bugs/rules";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Bugs" };

const PAGE = 50;
const TABS = [
  { id: "triage", label: "Needs triage", where: { status: "NEW" } },
  { id: "open", label: "Open", where: { status: { in: ["TRIAGED", "IN_PROGRESS", "NEED_INFO"] } } },
  { id: "fixed", label: "Fixed — check", where: { status: "FIXED" } },
  { id: "closed", label: "Closed", where: { status: { in: CLOSED_STATUSES } } },
  { id: "all", label: "All", where: {} },
] as const satisfies readonly { id: string; label: string; where: Prisma.BugReportWhereInput }[];

export default async function BugsAdmin({ searchParams }: PageProps<"/admin/bugs">) {
  const user = await requireSection("bugs");
  const triager = can(user.adminRoles, "bugs_triage");
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const mine = str("tab") === "mine";
  const tab = TABS.find((t) => t.id === str("tab")) ?? (mine ? null : triager ? TABS[0] : TABS[1]);
  const area = isArea(str("area")) ? str("area") : "";
  const priority = isPriority(str("priority")) ? str("priority") : "";
  const owner = str("owner");
  const q = str("q").slice(0, 100);
  const page = Math.max(1, Number(str("page")) || 1);

  const ref = q ? parseBugRef(q) : null;
  const where: Prisma.BugReportWhereInput = {
    ...(mine ? { assigneeId: user.id, status: { notIn: CLOSED_STATUSES } } : tab!.where),
    ...(area ? { area } : {}),
    ...(priority ? { priority: priority as never } : {}),
    ...(owner === "none" ? { assigneeId: null } : owner ? { assigneeId: owner } : {}),
    ...(q ? (ref ? { number: ref } : { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] }) : {}),
  };
  const openWhere = { status: { notIn: CLOSED_STATUSES } } as const;
  const [rows, total, counts, mineCount, overdue, staff, { timeZone }] = await Promise.all([
    db.bugReport.findMany({
      where,
      include: { assignee: { select: { name: true, email: true } }, _count: { select: { attachments: true } } },
      // Most urgent first: priority, then due date, then oldest.
      orderBy: [{ priority: { sort: "asc", nulls: "last" } }, { dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: PAGE,
      skip: (page - 1) * PAGE,
    }),
    db.bugReport.count({ where }),
    Promise.all(TABS.map((t) => db.bugReport.count({ where: t.where }))),
    db.bugReport.count({ where: { assigneeId: user.id, ...openWhere } }),
    db.bugReport.count({ where: { ...openWhere, status: { in: ["TRIAGED", "IN_PROGRESS", "NEED_INFO"] }, dueAt: { lt: new Date() } } }),
    db.user.findMany({ where: { disabled: false, NOT: { adminRoles: { isEmpty: true } } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    masjidClock(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone });
  const tabId = mine ? "mine" : tab!.id;
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams({ tab: tabId, ...(area && { area }), ...(priority && { priority }), ...(owner && { owner }), ...(q && { q }) });
    for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
    return `?${p}`;
  };

  return (
    <>
      <div className={styles.row} style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 className={styles.pageTitle}>Bugs</h1>
        {triager && <Link href="/admin/bugs/owners">Area owners →</Link>}
      </div>
      <p className={styles.pageLead}>
        Problems reported with the website’s “Report a problem” form (linked at the bottom of every page). New reports are
        triaged by a super admin — area, priority and owner — then the owner works on them and marks them fixed. Overdue
        bugs are highlighted.
      </p>
      {str("deleted") && <p className={styles.ok}>Bug report deleted.</p>}

      <div className={styles.stats}>
        <div className={`${styles.stat} ${counts[0] ? styles.statAlert : ""}`}>
          <span className={styles.statValue}>{counts[0]}</span>
          <span className={styles.statLabel}>Need triage</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{counts[1]}</span>
          <span className={styles.statLabel}>Open</span>
        </div>
        <div className={`${styles.stat} ${overdue ? styles.statAlert : ""}`}>
          <span className={styles.statValue}>{overdue}</span>
          <span className={styles.statLabel}>Overdue</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{mineCount}</span>
          <span className={styles.statLabel}>Assigned to you</span>
        </div>
      </div>

      <nav className={styles.tabs} aria-label="Bug status">
        <Link href="?tab=mine" className={`${styles.tab} ${mine ? styles.tabActive : ""}`} aria-current={mine ? "page" : undefined}>
          Mine ({mineCount})
        </Link>
        {TABS.map((t, i) => (
          <Link key={t.id} href={`?tab=${t.id}`} className={`${styles.tab} ${tabId === t.id ? styles.tabActive : ""}`} aria-current={tabId === t.id ? "page" : undefined}>
            {t.label} ({counts[i]})
          </Link>
        ))}
      </nav>

      <section className={styles.card}>
        <form className={styles.row} style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }} aria-label="Filter bugs">
          <input type="hidden" name="tab" value={tabId} />
          <label className={styles.field} style={{ margin: 0 }}>
            <span className={styles.label}>Search</span>
            <input name="q" defaultValue={q} placeholder="BUG-0012 or words" className={styles.input} style={{ width: 200 }} />
          </label>
          <label className={styles.field} style={{ margin: 0 }}>
            <span className={styles.label}>Area</span>
            <select name="area" defaultValue={area} className={styles.select}>
              <option value="">All areas</option>
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field} style={{ margin: 0 }}>
            <span className={styles.label}>Priority</span>
            <select name="priority" defaultValue={priority} className={styles.select}>
              <option value="">Any</option>
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field} style={{ margin: 0 }}>
            <span className={styles.label}>Owner</span>
            <select name="owner" defaultValue={owner} className={styles.select}>
              <option value="">Anyone</option>
              <option value="none">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.email}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={`${styles.btn} ${styles.secondary}`}>
            Filter
          </button>
          {(area || priority || owner || q) && <Link href={`?tab=${tabId}`}>Clear</Link>}
        </form>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bug</th>
                <th>Area</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Reported</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const late = isOverdue(b);
                return (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: "normal", maxWidth: 380 }}>
                      <Link href={`/admin/bugs/${b.number}`} style={{ fontWeight: 700 }}>
                        <span className={styles.muted}>{bugRef(b.number)}</span> <bdi>{b.title}</bdi>
                      </Link>
                      {b._count.attachments > 0 && <span className={styles.muted}> · 📎 {b._count.attachments}</span>}
                    </td>
                    <td>{areaLabel(b.area)}</td>
                    <td>{b.priority ? <span className={`${styles.badge} ${b.priority === "P1" || b.priority === "P2" ? styles.badgeWarn : ""}`}>{b.priority}</span> : <span className={styles.muted}>—</span>}</td>
                    <td>{statusLabel(b.status)}</td>
                    <td>{b.assignee ? (b.assignee.name ?? b.assignee.email) : <span className={styles.muted}>Unassigned</span>}</td>
                    <td className={styles.muted}>{day.format(b.createdAt)}</td>
                    <td>{b.dueAt ? <span className={late ? styles.err : styles.muted}>{late ? `Overdue · ${day.format(b.dueAt)}` : day.format(b.dueAt)}</span> : <span className={styles.muted}>—</span>}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.muted}>
                    No bugs here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className={styles.pager}>
            {page > 1 && <Link href={qs({ page: page - 1 })}>← Previous</Link>}
            <span className={styles.muted}>
              Page {page} of {pages}
            </span>
            {page < pages && <Link href={qs({ page: page + 1 })}>Next →</Link>}
          </div>
        )}
      </section>
    </>
  );
}
