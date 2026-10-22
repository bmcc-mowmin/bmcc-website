import Link from "next/link";
import { contactHref, routes } from "@/lib/routes";
import type { ThemedHomeData } from "./data";
import { Pattern, Photo } from "./parts";
import s from "./zayed.module.css";

// B · Evening and immersive (after Sheikh Zayed Grand Mosque): a full-width photo under a night
// veil with the day's prayers in an arch, a "Plan your visit" band, a wide photo, arched cards.
export function HomeZayed({ d }: { d: ThemedHomeData }) {
  const { t } = d;
  const [heroPhoto, bandPhoto, cardPhoto] = d.photos;
  const visit = [
    { title: t.hm_getting_here, desc: <bdi>{d.org.address}</bdi> },
    { title: t.hm_what_wear, desc: t.hm_what_wear_desc },
    { title: t.hm_tour, desc: t.hm_tour_desc, link: { href: contactHref(), label: t.nb_contact } },
  ];
  const cards = [
    { title: t.prayer_jumuah, desc: d.hasJumuah ? t.hm_jumuah_desc.replace("{times}", d.jumuahTimes) : t.tile_prayer_desc, href: routes.prayerTimes, photo: cardPhoto ?? bandPhoto },
    { title: t.tile_hikmah_title, desc: t.tile_hikmah_desc, href: routes.hikmahSchool, external: true },
    { title: t.nb_title, desc: t.hm_nb_short, href: routes.newBmcc },
  ];

  return (
    <div className={s.page}>
      <section className={s.hero}>
        {heroPhoto && <Photo photo={heroPhoto} className={s.heroBg} />}
        <div className={s.veil} />
        <div className={s.heroInner}>
          <div className={s.heroText}>
            <span className={s.heroEyebrow}>{t.home_eyebrow}</span>
            <h1 className={s.h1}>{t.hm_b_heading}</h1>
            <p className={s.heroLead}>{t.hm_intro}</p>
            <div className={s.heroActions}>
              <Link href={routes.prayerTimes} className={s.goldBtn}>
                {t.nav_prayer}
              </Link>
              <Link href="#b-visit" className={s.ghostBtn}>
                {t.hm_visit_title}
              </Link>
            </div>
          </div>
          <div className={s.arch}>
            <div className={s.archDate}>
              <span>{d.dateLabel}</span>
              {d.hijri && <span>{d.hijri}</span>}
            </div>
            <div role="table" aria-label={t.prayer_th_prayer}>
              <div role="row" className={`${s.archRow} ${s.archHead}`}>
                <span role="columnheader">{t.prayer_th_prayer}</span>
                <span role="columnheader">{t.prayer_th_adhan}</span>
                <span role="columnheader">{t.prayer_th_iqamah}</span>
              </div>
              {d.prayers.map((p) => (
                <div role="row" key={p.key} className={`${s.archRow} ${p.isNext ? s.archNext : ""}`}>
                  <span role="rowheader">
                    {p.name}
                    {p.isNext && <> — {t.hm_next}</>}
                  </span>
                  <span role="cell">{p.adhan}</span>
                  <span role="cell">{p.iqamah}</span>
                </div>
              ))}
            </div>
            {d.hasJumuah && <p className={s.archNote}>{t.hm_jumuah_line.replace("{times}", d.jumuahTimes)}</p>}
          </div>
        </div>
      </section>

      <section id="b-visit" className={s.visit} aria-labelledby="b-visit-title">
        <div className={s.centered}>
          <h2 id="b-visit-title" className={s.h2}>
            {t.hm_visit_title}
          </h2>
          <p className={s.muted}>{t.hm_visit_sub}</p>
        </div>
        <div className={s.visitGrid}>
          {visit.map((v) => (
            <div key={v.title} className={s.visitCell}>
              <p className={s.visitTitle}>{v.title}</p>
              <p className={s.muted}>{v.desc}</p>
              {v.link && (
                <Link href={v.link.href} className={s.goldLink}>
                  {v.link.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {bandPhoto && (
        <figure className={s.band}>
          <Photo photo={bandPhoto} className={s.bandImg} />
          <figcaption className={s.bandCaption}>
            <bdi>{bandPhoto.alt}</bdi>
          </figcaption>
        </figure>
      )}

      <section className={s.cards}>
        {cards.map((c) => (
          <Link key={c.title} href={c.href} className={s.card} {...(c.external ? { target: "_blank", rel: "noopener" } : {})}>
            {c.photo ? <Photo photo={{ url: c.photo.url, alt: "" }} className={s.cardArch} /> : <Pattern className={`${s.cardArch} ${s.pattern}`} />}
            <span className={s.cardTitle}>{c.title}</span>
            <span className={s.muted}>{c.desc}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
