import type { Metadata } from "next";
import { db } from "@/lib/db";
import type { L10n } from "@/lib/i18n/dictionary";
import { masjidClock } from "@/lib/prayer/schedule";
import { wallClock } from "@/lib/events/recurrence";
import { ActionForm } from "@/components/admin/ActionForm";
import { L10nField } from "@/components/admin/L10nField";
import styles from "@/components/admin/admin.module.css";
import { deleteAnnouncement, saveAnnouncement } from "./actions";

export const metadata: Metadata = { title: "Announcements" };

type Row = Awaited<ReturnType<typeof db.announcement.findMany>>[number];

function statusOf(a: Row, now: Date) {
  if (!a.active) return { label: "Hidden", warn: true };
  if (a.startAt > now) return { label: "Scheduled", warn: false };
  if (a.endAt && a.endAt <= now) return { label: "Expired", warn: true };
  return { label: "Showing now", warn: false };
}

export default async function AnnouncementsAdmin() {
  const [rows, { timeZone, date }] = await Promise.all([
    db.announcement.findMany({ orderBy: [{ sortOrder: "asc" }, { startAt: "asc" }] }),
    masjidClock(),
  ]);
  const now = new Date();
  const local = (d: Date | null) => {
    if (!d) return "";
    const w = wallClock(d, timeZone);
    return `${w.date}T${w.time}`;
  };
  const live = rows.filter((r) => statusOf(r, now).label === "Showing now").length;

  return (
    <>
      <h1 className={styles.pageTitle}>Announcements</h1>
      <p className={styles.pageLead}>
        The scrolling “Updates” ticker on every page (and the strip on Home, which shows the first one). An announcement
        shows only between its start and end and while Active; with none showing, the ticker is hidden. Times are masjid
        time ({timeZone}). <strong>{live}</strong> showing now.
      </p>

      <section className={styles.card} style={{ borderColor: "var(--primary)" }}>
        <h2 className={styles.cardTitle}>Add an announcement</h2>
        <AnnouncementForm local={local} defaultStart={`${date}T00:00`} />
      </section>

      {rows.length > 0 && <h2 className={styles.cardTitle} style={{ margin: "8px 0 12px" }}>Current announcements</h2>}
      {rows.map((a) => {
        const s = statusOf(a, now);
        return (
          <section key={a.id} className={styles.card}>
            <div className={styles.monthNav} style={{ marginBottom: 8 }}>
              <span className={`${styles.badge} ${s.warn ? styles.badgeWarn : ""}`}>{s.label}</span>
            </div>
            <AnnouncementForm row={a} local={local} />
            <div style={{ marginTop: 8 }}>
              <ActionForm action={deleteAnnouncement} submitLabel="Delete" variant="danger" confirm="Delete this announcement?">
                <input type="hidden" name="id" value={a.id} />
              </ActionForm>
            </div>
          </section>
        );
      })}

    </>
  );
}

function AnnouncementForm({ row, local, defaultStart }: { row?: Row; local: (d: Date | null) => string; defaultStart?: string }) {
  const key = row?.id ?? "new";
  return (
    <ActionForm action={saveAnnouncement} submitLabel={row ? "Save" : "Add announcement"} resetOnSuccess={!row}>
      <input type="hidden" name="id" value={row?.id ?? ""} />
      <L10nField name="text" label="Text" value={row?.text as L10n | undefined} idPrefix={key} />
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${key}-link`}>
            Link (optional)
          </label>
          <input id={`${key}-link`} name="link" defaultValue={row?.link ?? ""} placeholder="/events or https://…" className={styles.input} style={{ width: 240 }} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${key}-start`}>
            Show from
          </label>
          <input id={`${key}-start`} name="startAt" type="datetime-local" required defaultValue={row ? local(row.startAt) : defaultStart} className={styles.input} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${key}-end`}>
            Until (optional)
          </label>
          <input id={`${key}-end`} name="endAt" type="datetime-local" defaultValue={local(row?.endAt ?? null)} className={styles.input} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${key}-sort`}>
            Order
          </label>
          <input id={`${key}-sort`} name="sortOrder" type="number" defaultValue={row?.sortOrder ?? 10} className={styles.input} style={{ width: 80 }} />
        </div>
        <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <input type="checkbox" name="active" defaultChecked={row?.active ?? true} /> Active
        </label>
      </div>
    </ActionForm>
  );
}
