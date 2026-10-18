import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { intlLocale, ltrIsolate } from "@/lib/i18n/config";
import { getCampaign, getCampaignUpdates, CAMPAIGN_FUND } from "@/lib/campaign";
import { collectionPhotos, slotImage } from "@/lib/media";
import { usd } from "@/lib/payments/catalog";
import { contactHref, routes } from "@/lib/routes";
import styles from "./new-bmcc.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nb_title, description: t.nb_intro };
}

// The New BMCC project: the land BMCC bought for its new masjid and school. Land photos (the
// "New BMCC project" collection in the Media library) appear here and nowhere else.
export default async function NewBmccPage() {
  const { t, lang } = await getI18n();
  const locale = intlLocale(lang);
  const [campaign, updates, gallery, heroSlot, why] = await Promise.all([
    getCampaign(),
    getCampaignUpdates(lang),
    collectionPhotos("new-bmcc", lang),
    slotImage("new_bmcc_hero", lang),
    slotImage("new_bmcc_why", lang),
  ]);
  const hero = heroSlot ?? gallery[0] ?? null;
  const rest = gallery.filter((p) => p.url !== hero?.url);
  const giveOnce = `${routes.donate}?fund=${CAMPAIGN_FUND}&frequency=one-time`;
  const pct = campaign.showProgress && campaign.goalCents ? Math.min(100, Math.round((campaign.raisedCents / campaign.goalCents) * 100)) : null;
  const day = (d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(d);

  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>{t.nb_eyebrow}</p>
            <h1 className={styles.h1}>{t.nb_heading}</h1>
            <p className={styles.lead}>{t.nb_intro}</p>
            <div className={styles.actions}>
              <Link href={giveOnce} className="btn btn-primary">
                {t.nb_give_once}
              </Link>
              <Link href={`${routes.donate}?fund=${CAMPAIGN_FUND}&frequency=monthly`} className={styles.secondary}>
                {t.nb_give_monthly}
              </Link>
            </div>
          </div>
          {hero && (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo
            <img src={hero.url} alt={hero.alt} className={styles.heroImg} />
          )}
        </div>
      </section>

      <section className={`container ${styles.facts}`} aria-label={t.nb_facts_label}>
        <div>
          <span className={styles.factValue}>{t.nb_fact_land}</span>
          <span className={styles.factLabel}>{t.nb_fact_land_label}</span>
        </div>
        <div>
          <span className={styles.factValue}>{t.nb_fact_families}</span>
          <span className={styles.factLabel}>{t.nb_fact_families_label}</span>
        </div>
        <div>
          <span className={styles.factValue}>{t.nb_fact_use}</span>
          <span className={styles.factLabel}>{t.nb_fact_use_label}</span>
        </div>
      </section>

      {pct != null && (
        <section className={`container ${styles.progress}`} aria-labelledby="nb-progress">
          <h2 id="nb-progress" className={styles.h2}>
            {t.nb_progress_title}
          </h2>
          <p className={styles.progressLine}>
            {t.nb_progress_raised.replace("{raised}", ltrIsolate(usd(campaign.raisedCents), locale)).replace("{goal}", ltrIsolate(usd(campaign.goalCents!), locale))}
          </p>
          <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t.nb_progress_title}>
            <span style={{ width: `${pct}%` }} />
          </div>
          {campaign.raisedAsOf && <p className={styles.asOf}>{t.nb_progress_asof.replace("{date}", day(campaign.raisedAsOf))}</p>}
        </section>
      )}

      <section className={`container ${styles.why}`} aria-labelledby="nb-why">
        <div>
          <h2 id="nb-why" className={styles.h2}>
            {t.nb_why_title}
          </h2>
          <p className={styles.body}>{t.nb_why_text}</p>
        </div>
        {why && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo
          <img src={why.url} alt={why.alt} className={styles.whyImg} />
        )}
      </section>

      <section className={`container ${styles.section}`} aria-labelledby="nb-land">
        <h2 id="nb-land" className={styles.h2}>
          {t.nb_land_title}
        </h2>
        {rest.length > 0 ? (
          <ul className={styles.gallery}>
            {rest.map((p) => (
              <li key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo */}
                <img src={p.url} alt={p.alt} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>{t.nb_land_empty}</p>
        )}
      </section>

      <section className={`container ${styles.section}`} aria-labelledby="nb-updates">
        <h2 id="nb-updates" className={styles.h2}>
          {t.nb_updates_title}
        </h2>
        {updates.length === 0 ? (
          <p className={styles.muted}>{t.nb_updates_empty}</p>
        ) : (
          <ol className={styles.timeline}>
            {updates.map((u) => (
              <li key={u.id}>
                <time dateTime={u.date.toISOString().slice(0, 10)} className={styles.updateDate}>
                  {day(u.date)}
                </time>
                <h3 className={styles.updateTitle} dir="auto">
                  {u.titleText}
                </h3>
                <p className={styles.body} dir="auto">
                  {u.bodyText}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.giveBand} aria-labelledby="nb-ways">
        <div className="container">
          <h2 id="nb-ways" className={styles.h2}>
            {t.nb_ways_title}
          </h2>
          <div className={styles.ways}>
            <div>
              <h3>{t.nb_way_once_title}</h3>
              <p>{t.nb_way_once_text}</p>
              <Link href={giveOnce}>{t.nb_give_once} →</Link>
            </div>
            <div>
              <h3>{t.nb_way_monthly_title}</h3>
              <p>{t.nb_way_monthly_text}</p>
              <Link href={`${routes.donate}?fund=${CAMPAIGN_FUND}&frequency=monthly`}>{t.nb_give_monthly} →</Link>
            </div>
            <div>
              <h3>{t.nb_way_large_title}</h3>
              <p>{t.nb_way_large_text}</p>
              <Link href={contactHref("new-bmcc")}>{t.nb_contact} →</Link>
            </div>
          </div>
          <p className={styles.taxNote}>{t.nb_tax_note}</p>
        </div>
      </section>
    </>
  );
}
