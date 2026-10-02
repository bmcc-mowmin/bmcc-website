import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth";
import { getMyRsvps } from "@/lib/account";
import { localize } from "@/lib/i18n/dictionary";
import { intlLocale, ltrIsolate } from "@/lib/i18n/config";
import { masjidClock } from "@/lib/prayer/schedule";
import { routes } from "@/lib/routes";
import { cancelRsvpAction } from "../../events/[slug]/actions";
import styles from "../account.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.acct_tab_events, robots: { index: false } };
}

export default async function MyRsvpsPage() {
  const user = await requireMember("/account/events");
  const { t, lang } = await getI18n();
  const [rsvps, { timeZone }] = await Promise.all([getMyRsvps(user), masjidClock()]);
  const locale = intlLocale(lang);
  const when = (r: (typeof rsvps)[number]) =>
    r.event.allDay
      ? new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone }).format(r.occurrenceStart)
      : `${new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone }).format(r.occurrenceStart)} · ${ltrIsolate(new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone }).format(r.occurrenceStart), locale)}`;

  return (
    <section className={styles.card} aria-labelledby="rsvps-title">
      <h2 id="rsvps-title" className={styles.cardTitle}>
        {t.acct_rsvps_title}
      </h2>
      {rsvps.length === 0 ? (
        <p className={styles.text}>
          {t.acct_no_rsvps} <Link href={routes.events}>{t.evc_view_all} →</Link>
        </p>
      ) : (
        <ul className={styles.people}>
          {rsvps.map((r) => (
            <li key={r.id}>
              <Link href={`/events/${r.event.slug}`} className={styles.personName}>
                {localize(r.event.title, lang)}
              </Link>
              <span className={styles.muted}>
                {when(r)} · {t.acct_party.replace("{n}", String(r.partySize))}
              </span>
              <form action={cancelRsvpAction}>
                <input type="hidden" name="rsvpId" value={r.id} />
                <input type="hidden" name="back" value="/account/events" />
                <button type="submit" className={styles.linkDanger}>
                  {t.rsvp_cancel}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
