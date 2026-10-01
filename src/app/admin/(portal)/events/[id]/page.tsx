import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { localize } from "@/lib/i18n/dictionary";
import { masjidClock } from "@/lib/prayer/schedule";
import styles from "@/components/admin/admin.module.css";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEvent({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  await requireSection("events");
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const [event, { date, timeZone }] = await Promise.all([db.event.findUnique({ where: { id } }), masjidClock()]);
  if (!event) notFound();
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
    </>
  );
}
