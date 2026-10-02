import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { formatEventWhen, getEventBySlug } from "@/lib/events";
import { masjidClock } from "@/lib/prayer/schedule";
import { routes } from "@/lib/routes";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MAX_PARTY, rsvpDates } from "@/lib/events/rsvp";
import { cancelRsvpAction } from "./actions";
import { RsvpForm } from "./RsvpForm";
import styles from "../events.module.css";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { t, lang } = await getI18n();
  const event = await getEventBySlug(slug, lang);
  return event ? { title: event.title, description: event.description.slice(0, 160) } : { title: t.event_not_found };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const { t, lang } = await getI18n();
  const [event, { timeZone }] = await Promise.all([getEventBySlug(slug, lang), masjidClock()]);
  if (!event) notFound();
  const [user, rsvp] = await Promise.all([getCurrentUser(), rsvpDates(event.id)]);
  const mine = user && rsvp ? await db.eventRsvp.findMany({ where: { eventId: event.id, userId: user.id, occurrenceStart: { gte: new Date() } }, orderBy: { occurrenceStart: "asc" } }) : [];
  const when = formatEventWhen(event, event.next, lang, t, timeZone);

  return (
    <section className="container section-y">
      <Link href={routes.events} className={styles.back}>
        {t.event_back}
      </Link>
      <div className={styles.detailGrid}>
        <div>
          <div className={styles.tag} style={{ display: "inline-block" }}>
            {event.tag}
          </div>
          <h1 className={`page-h1 ${styles.detailH1}`}>{event.title}</h1>
          {event.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo
            <img src={event.imageUrl} alt="" className={styles.photo} />
          )}
          <p className={styles.body}>{event.description}</p>
        </div>
        <aside className={styles.panel} aria-label={t.event_when}>
          <p className={styles.panelLabel}>{t.event_when}</p>
          <p className={styles.panelValue}>
            {event.recurringWeekday !== null ? when.date : when.fullDate}
            {when.timeRange && (
              <>
                <br />
                {when.timeRange}
              </>
            )}
          </p>
          {event.recurringWeekday !== null && event.upcoming.length > 1 && (
            <>
              <p className={styles.panelLabel}>{t.event_next_dates}</p>
              <ul className={styles.dates}>
                {event.upcoming.map((o) => (
                  <li key={o.start.toISOString()}>{formatEventWhen(event, o, lang, t, timeZone).fullDate}</li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.panelLabel}>{t.event_where}</p>
          <p className={styles.panelValue}>{event.location}</p>
          {rsvp && (
            <div className={styles.rsvp} id="rsvp">
              <p className={styles.panelLabel}>{t.rsvp_title}</p>
              {mine.map((r) => (
                <form key={r.id} action={cancelRsvpAction} className={styles.rsvpMine}>
                  <span role="status">
                    {t.rsvp_going.replace("{n}", String(r.partySize)).replace("{date}", formatEventWhen(event, { start: r.occurrenceStart, end: r.occurrenceStart }, lang, t, timeZone).fullDate)}
                  </span>
                  <input type="hidden" name="rsvpId" value={r.id} />
                  <input type="hidden" name="back" value={`/events/${event.slug}`} />
                  <button type="submit" className={styles.linkButton}>
                    {t.rsvp_cancel}
                  </button>
                </form>
              ))}
              {user ? (
                <RsvpForm
                  slug={event.slug}
                  maxParty={MAX_PARTY}
                  dates={rsvp.dates.map((d) => ({
                    iso: d.start.toISOString(),
                    label: formatEventWhen(event, d, lang, t, timeZone).fullDate,
                    left: d.left,
                    mine: mine.find((r) => r.occurrenceStart.getTime() === d.start.getTime())?.partySize ?? null,
                  }))}
                />
              ) : (
                <Link href={`/login?next=${encodeURIComponent(`/events/${event.slug}#rsvp`)}`} className="btn btn-primary">
                  {t.rsvp_sign_in}
                </Link>
              )}
            </div>
          )}
          <p className={styles.panelLabel}>{t.add_to_calendar}</p>
          <div className={styles.panelActions}>
            <a href={event.icsUrl} className={styles.calButton}>
              {t.events_ical}
            </a>
            <a href={event.googleUrl} target="_blank" rel="noopener" className={styles.calButton}>
              {t.events_gcal}
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
