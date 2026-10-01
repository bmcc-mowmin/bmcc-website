import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { masjidClock } from "@/lib/prayer/schedule";
import { LANGS } from "@/lib/i18n/config";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { deleteSubscriber, unsubscribeSubscriber } from "./actions";

export const metadata: Metadata = { title: "Subscribers" };

const PAGE = 50;
const TABS = [
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "PENDING", label: "Waiting for confirmation" },
  { status: "UNSUBSCRIBED", label: "Unsubscribed" },
] as const;
const SOURCE_LABEL: Record<string, string> = { resub_bar: "Re-subscribe bar", newsletter: "Stay Connected" };
const langLabel = (code: string) => LANGS.find((l) => l.code === code)?.label ?? code;

export default async function SubscribersAdmin({ searchParams }: PageProps<"/admin/subscribers">) {
  await requireSection("subscribers");
  const params = await searchParams;
  const status = TABS.find((t) => t.status === params.status)?.status ?? "CONFIRMED";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const page = Math.max(1, Number(params.page) || 1);
  const where: Prisma.SubscriberWhereInput = { status, ...(q ? { email: { contains: q.toLowerCase() } } : {}) };

  const [rows, total, counts, bySource, { timeZone }] = await Promise.all([
    db.subscriber.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    db.subscriber.count({ where }),
    db.subscriber.groupBy({ by: ["status"], _count: true }),
    db.subscriber.groupBy({ by: ["source"], where: { status: "CONFIRMED" }, _count: true }),
    masjidClock(),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: Record<string, string | number>) => `?${new URLSearchParams(Object.entries({ status, ...(q ? { q } : {}), ...p }).map(([k, v]) => [k, String(v)]))}`;
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone });

  return (
    <>
      <div className={styles.monthNav}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>
          Mailing list
        </h1>
        <a href="/admin/subscribers/export" download className={`${styles.btn} ${styles.secondary}`} style={{ marginInlineStart: "auto" }}>
          Export confirmed (CSV)
        </a>
      </div>
      <p className={styles.pageLead}>
        The new BMCC list. People sign up with the re-subscribe bar or the “Stay Connected” form on Home, and are added
        only after they press the button in the confirmation email (double opt-in). Every list email must include
        the person’s unsubscribe link — it is in the CSV export.
      </p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{count("CONFIRMED")}</div>
          <div className={styles.statLabel}>Confirmed subscribers</div>
        </div>
        {Object.entries(SOURCE_LABEL).map(([source, label]) => (
          <div key={source} className={styles.stat}>
            <div className={styles.statValue}>{bySource.find((s) => s.source === source)?._count ?? 0}</div>
            <div className={styles.statLabel}>Confirmed via {label}</div>
          </div>
        ))}
      </div>

      <form className={styles.row} style={{ marginBottom: 12 }}>
        <input name="q" defaultValue={q} placeholder="Email address" aria-label="Search subscribers" className={styles.input} style={{ width: 300 }} />
        <input type="hidden" name="status" value={status} />
        <button type="submit" className={`${styles.btn} ${styles.secondary}`}>
          Search
        </button>
      </form>
      <nav className={styles.tabs} aria-label="Subscriber status">
        {TABS.map((t) => (
          <Link key={t.status} href={link({ status: t.status })} className={`${styles.tab} ${t.status === status ? styles.tabActive : ""}`} aria-current={t.status === status ? "page" : undefined}>
            {t.label} ({count(t.status)})
          </Link>
        ))}
      </nav>

      <section className={styles.card}>
        {status === "PENDING" && (
          <p className={styles.muted} style={{ marginTop: 0 }}>
            These people haven’t confirmed yet and receive nothing. Confirmation links work for 7 days; signing up again sends a new one.
          </p>
        )}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Signed up with</th>
                <th>Language</th>
                <th>Signed up</th>
                <th>{status === "UNSUBSCRIBED" ? "Unsubscribed" : "Confirmed"}</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.email}</td>
                  <td>{SOURCE_LABEL[s.source] ?? s.source}</td>
                  <td>{langLabel(s.lang)}</td>
                  <td className={styles.muted}>{day.format(s.createdAt)}</td>
                  <td className={styles.muted}>{(status === "UNSUBSCRIBED" ? s.unsubscribedAt : s.confirmedAt) ? day.format((status === "UNSUBSCRIBED" ? s.unsubscribedAt : s.confirmedAt)!) : "—"}</td>
                  <td>
                    <div className={styles.row} style={{ gap: 8, flexWrap: "nowrap" }}>
                      {status !== "UNSUBSCRIBED" && (
                        <ActionForm action={unsubscribeSubscriber} submitLabel="Unsubscribe" variant="secondary" confirm={`Stop all mailing-list email to ${s.email}?`}>
                          <input type="hidden" name="id" value={s.id} />
                        </ActionForm>
                      )}
                      <ActionForm action={deleteSubscriber} submitLabel="Delete" variant="danger" confirm={`Permanently delete ${s.email} from the list? Use this when someone asks for their data to be removed.`}>
                        <input type="hidden" name="id" value={s.id} />
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.muted}>
                    {q ? "No subscribers match that search." : "None yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className={styles.pager}>
            {page > 1 && <Link href={link({ page: page - 1 })}>← Newer</Link>}
            <span className={styles.muted}>
              Page {page} of {pages} · {total} subscribers
            </span>
            {page < pages && <Link href={link({ page: page + 1 })}>Older →</Link>}
          </div>
        )}
      </section>
    </>
  );
}
