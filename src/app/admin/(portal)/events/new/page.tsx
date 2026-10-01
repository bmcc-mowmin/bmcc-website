import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import Link from "next/link";
import { masjidClock } from "@/lib/prayer/schedule";
import styles from "@/components/admin/admin.module.css";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "New event" };

export default async function NewEvent() {
  await requireSection("events");
  const { date, timeZone } = await masjidClock();
  return (
    <>
      <Link href="/admin/events">← Events</Link>
      <h1 className={styles.pageTitle} style={{ marginTop: 10 }}>
        New event
      </h1>
      <p className={styles.pageLead}>It appears on the site as soon as you create it, unless you untick “Published”.</p>
      <EventForm timeZone={timeZone} defaultDate={date} />
    </>
  );
}
