import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { localize } from "@/lib/i18n/dictionary";
import { masjidClock } from "@/lib/prayer/schedule";
import styles from "@/components/admin/admin.module.css";
import { rsvpsForEvent } from "@/lib/events/rsvp";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEvent({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  await requireSection("events");
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const [event, { date, timeZone }, rsvps] = await Promise.all([db.event.findUnique({ where: { id } }), masjidClock(), rsvpsForEvent(id)]);
  if (!event) notFound();
  const byDate = new Map<string, typeof rsvps>();
  for (const r of rsvps) byDate.set(r.occurrenceStart.toISOString(), [...(byDate.get(r.occurrenceStart.toISOString()) ?? []), r]);
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: event.allDay ? undefined : "short", timeZone });
  return (
    <>
      <Link href="/admin/events">← Events</Link>
      <div className={styles.monthNav} style={{ marginTop: 10 }}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>
          {localize(event.title, "en")}
        </h1>
        <Link href={`/events/${event.slug}`} target="_blank" style={{ marginInlineStart: "auto", fontSize: 14 }}>
          View on site ↗
        </Link>
      </div>
      {(status === "saved" || status === "created") && (
        <p role="status" className={styles.ok}>
          {status === "created" ? "Event created." : "Saved."} The site is updated.
        </p>
      )}
      {/* key: remount after each save so inputs show the stored values */}
      <EventForm key={event.updatedAt.toISOString()} event={event} timeZone={timeZone} defaultDate={date} />

      {(event.rsvpEnabled || rsvps.length > 0) && (
        <section className={styles.card} style={{ marginTop: 20 }} aria-labelledby="rsvp-title">
          <h2 id="rsvp-title" className={styles.cardTitle}>
            RSVPs
          </h2>
          {rsvps.length === 0 && <p className={styles.muted}>No RSVPs yet for upcoming dates.</p>}
          {[...byDate].map(([iso, list]) => {
            const people = list.reduce((n, r) => n + r.partySize, 0);
            return (
              <div key={iso} style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, margin: "0 0 6px" }}>
                  {day.format(new Date(iso))} — {people} {people === 1 ? "person" : "people"}
                  {event.rsvpCapacity ? ` of ${event.rsvpCapacity}` : ""}
                </h3>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.id}>
                          <td>{r.user.name ?? "—"}</td>
                          <td>{r.user.email}</td>
                          <td>{r.partySize}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
