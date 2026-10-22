import Link from "next/link";
import { routes } from "@/lib/routes";
import type { ThemedHomeData } from "./data";
import { Ornament, Pattern, Photo } from "./parts";
import s from "./cambridge.module.css";

// A · Light and classical (after Cambridge Central Mosque): a quiet prayer strip, one large photo,
// a centered welcome, three line-icon columns, and bordered cards.
export function HomeCambridge({ d }: { d: ThemedHomeData }) {
  const { t } = d;
  const next = d.oneOff[0] ?? d.weekly[0];
  const cards = [
    { title: t.hm_prayers_title, desc: d.hasJumuah ? t.hm_prayers_desc.replace("{times}", d.jumuahTimes) : t.tile_prayer_desc, href: routes.prayerTimes, cta: t.nav_prayer, photo: d.photos[1] },
    { title: t.tile_hikmah_title, desc: t.tile_hikmah_desc, href: routes.hikmahSchool, cta: t.hm_learn_more, photo: undefined, external: true },
    { title: t.tile_services_title, desc: t.tile_services_desc, href: routes.services, cta: t.hm_all_services, photo: d.photos[2] },
  ];
  const columns = [
    { title: t.nav_about_us, desc: t.hm_about_desc, href: routes.about, icon: "dome" as const },
    { title: t.hm_visit_title, desc: (
        <>
          {t.hm_visit_desc.split("{address}")[0]}
          <bdi>{d.org.addressShort}</bdi>
          {t.hm_visit_desc.split("{address}")[1]}
        </>
      ), href: routes.contact, icon: "pin" as const },
    { title: t.hm_support_title, desc: t.hm_support_desc, href: routes.donate, icon: "hands" as const },
  ];

  return (
    <div className={s.page}>
      <section className={s.strip} aria-label={t.prayer_page_eyebrow}>
        <div className={s.stripDate}>
          <strong>
            {d.dateLabel}
            {d.hijri && <> · {d.hijri}</>}
          </strong>
          <Link href={routes.prayerTimes}>{t.hm_full_timetable}</Link>
        </div>
        <div role="table" aria-label={t.prayer_th_prayer} className={s.stripTable}>
          <div role="row" className={s.stripRow}>
            <span role="columnheader" className={s.stripHead} />
            {d.prayers.map((p) => (
              <span role="columnheader" key={p.key} className={p.isNext ? s.isNext : s.stripHead}>
                {p.name}
              </span>
            ))}
          </div>
          {(["adhan", "iqamah"] as const).map((k) => (
            <div role="row" key={k} className={s.stripRow}>
              <span role="rowheader" className={s.stripHead}>
                {k === "adhan" ? t.hm_begins : t.prayer_th_iqamah}
              </span>
              {d.prayers.map((p) => (
                <span role="cell" key={p.key} className={p.isNext ? s.isNext : undefined}>
                  {p[k]}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {d.photos[0] && (
        <div className={s.hero}>
          <Photo photo={d.photos[0]} className={s.heroImg} />
        </div>
      )}

      <section className={s.welcome}>
        <Ornament className={s.ornament} />
        <h1 className={s.h1}>{t.hm_a_heading}</h1>
        <p className={s.lead}>{t.hm_intro}</p>
      </section>

      <section className={s.columns}>
        {columns.map((c) => (
          <div key={c.title} className={s.column}>
            <span className={s.iconRing} aria-hidden>
              <LineIcon name={c.icon} />
            </span>
            <Link href={c.href} className={s.columnTitle}>
              {c.title}
            </Link>
            <p>{c.desc}</p>
          </div>
        ))}
      </section>

      {next && (
        <section className={s.comingUp} aria-label={t.hm_coming_up}>
          <span className={s.comingLabel}>{t.hm_coming_up}</span>
          <p>
            <strong>
              <bdi>{next.title}</bdi>
            </strong>{" "}
            — {next.date}
            {next.time && <> · {next.time}</>}
          </p>
          <Link href={`${routes.events}/${next.slug}`}>{t.evc_read_more}</Link>
        </section>
      )}

      <section className={s.visit} aria-labelledby="a-visit">
        <h2 id="a-visit" className={s.h2}>
          {t.hm_visit_heading}
        </h2>
        <div className={s.cards}>
          {cards.map((c) => (
            <div key={c.title} className={s.card}>
              {c.photo ? <Photo photo={c.photo} className={s.cardImg} /> : <Pattern className={`${s.cardImg} ${s.pattern}`} />}
              <div className={s.cardBody}>
                <span className={s.cardTitle}>{c.title}</span>
                <span className={s.muted}>{c.desc}</span>
                <Link href={c.href} {...(c.external ? { target: "_blank", rel: "noopener" } : {})}>
                  {c.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={s.project} aria-labelledby="a-project">
        <Pattern className={`${s.projectArt} ${s.pattern}`} />
        <div className={s.projectBody}>
          <span className={s.eyebrow}>{t.nb_title}</span>
          <h2 id="a-project" className={s.projectH2}>
            {t.hm_nb_heading}
          </h2>
          <p className={s.muted}>{t.hm_nb_desc}</p>
          <div className={s.projectActions}>
            <Link href={`${routes.donate}?fund=new-bmcc`} className={s.pillBtn}>
              {t.nb_give_once}
            </Link>
            <Link href={routes.newBmcc}>{t.nb_about_project}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function LineIcon({ name }: { name: "dome" | "pin" | "hands" }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.3">
      {name === "dome" && (
        <>
          <path d="M8 38V20c0-7 6-12 14-12s14 5 14 12v18" />
          <path d="M4 38h36" />
          <path d="M17 38v-9a5 5 0 0 1 10 0v9" />
          <path d="M22 8V3" />
        </>
      )}
      {name === "pin" && (
        <>
          <path d="M22 40s-12-12-12-21a12 12 0 0 1 24 0c0 9-12 21-12 21z" />
          <circle cx="22" cy="19" r="4.5" />
        </>
      )}
      {name === "hands" && (
        <>
          <path d="M6 26l9 8c2 2 6 2 8 0l15-14" />
          <path d="M14 18c-2-4 0-8 4-8 2 0 3 1 4 2 1-1 2-2 4-2 4 0 6 4 4 8l-8 7z" />
        </>
      )}
    </svg>
  );
}
