import Link from "next/link";
import { routes } from "@/lib/routes";
import type { ThemedHomeData } from "./data";
import { Pattern, Photo } from "./parts";
import s from "./irvine.module.css";

// C · Warm and people-first (after Islamic Center of Irvine): name and "Today" card side by side,
// a row of photo tiles, upcoming and weekly events in soft cards, and a maroon giving banner.
export function HomeIrvine({ d }: { d: ThemedHomeData }) {
  const { t } = d;
  const tileLabels = [
    { label: t.evc_heading, href: routes.events },
    { label: t.prayer_jumuah, href: routes.prayerTimes },
    { label: t.hm_tile_visit, href: routes.contact },
  ];
  const tiles = d.photos.slice(0, 3).map((photo, i) => ({ photo, ...tileLabels[i] }));

  return (
    <div className={s.page}>
      <section className={s.intro}>
        <div className={s.introText}>
          <h1 className={s.h1}>{t.home_eyebrow}</h1>
          <p className={s.lead}>{t.hm_c_intro}</p>
          <div className={s.actions}>
            <Link href={routes.prayerTimes} className={s.btnSolid}>
              {t.hm_month_times}
            </Link>
            <Link href={routes.membership} className={s.btnOutline}>
              {t.btn_become_member}
            </Link>
          </div>
        </div>
        <div className={s.today}>
          <div className={s.todayHead}>
            <h2 className={s.todayTitle}>{t.hm_today}</h2>
            <span className={s.small}>
              {d.dateLabel}
              {d.hijri && <> · {d.hijri}</>}
            </span>
          </div>
          <div role="table" aria-label={t.prayer_th_prayer}>
            <div role="row" className={`${s.row} ${s.rowHead}`}>
              <span role="columnheader">{t.prayer_th_prayer}</span>
              <span role="columnheader">{t.hm_begins}</span>
              <span role="columnheader">{t.prayer_th_iqamah}</span>
            </div>
            {d.prayers.map((p, i) => (
              <div role="row" key={p.key} className={`${s.row} ${p.isNext ? s.rowNext : i % 2 ? s.rowAlt : ""}`}>
                <span role="rowheader">
                  {p.name}
                  {p.isNext && <> · {t.hm_next}</>}
                </span>
                <span role="cell">{p.adhan}</span>
                <span role="cell">{p.iqamah}</span>
              </div>
            ))}
          </div>
          {d.hasJumuah && <p className={s.jumuah}>{t.hm_jumuah_line.replace("{times}", d.jumuahTimes)}</p>}
        </div>
      </section>

      <section className={s.tiles} aria-label={t.explore_heading}>
        {tiles.map((tile, i) => (
          <Link key={tile.href} href={tile.href} className={`${s.tile} ${i === 0 ? s.tileWide : ""}`}>
            <Photo photo={{ url: tile.photo.url, alt: "" }} className={s.tileImg} />
            <span className={s.chip}>{tile.label}</span>
          </Link>
        ))}
        <Link href={routes.newBmcc} className={s.tile}>
          <Pattern className={`${s.tileImg} ${s.pattern}`} />
          <span className={s.chip}>{t.nb_title}</span>
        </Link>
      </section>

      <section className={s.twoCards}>
        <div className={s.softCard}>
          <h2 className={s.cardH2}>{t.evc_heading}</h2>
          {d.oneOff.length === 0 && <p className={s.small}>{t.events_empty}</p>}
          {d.oneOff.slice(0, 3).map((e, i) => (
            <Link key={e.slug} href={`${routes.events}/${e.slug}`} className={s.eventRow}>
              <span className={`${s.dateBadge} ${i === 0 ? s.dateBadgeStrong : ""}`}>
                <span>{e.month}</span>
                <strong>{e.day}</strong>
              </span>
              <span>
                <strong>
                  <bdi>{e.title}</bdi>
                </strong>
                <span className={s.small}>
                  {e.date}
                  {e.time && <> · {e.time}</>}
                </span>
              </span>
            </Link>
          ))}
          <Link href={routes.events} className={s.cardLink}>
            {t.evc_view_all}
          </Link>
        </div>
        <div className={s.softCard}>
          <h2 className={s.cardH2}>{t.hm_every_week}</h2>
          {d.weekly.length === 0 && <p className={s.small}>{t.events_empty}</p>}
          {d.weekly.slice(0, 4).map((e) => (
            <Link key={e.slug} href={`${routes.events}/${e.slug}`} className={s.weekRow}>
              <span className={s.dayPill}>{e.weekday}</span>
              <span>
                <strong>
                  <bdi>{e.title}</bdi>
                </strong>
                {e.time && <span className={s.inline}> · {e.time}</span>}
              </span>
            </Link>
          ))}
          <Link href={routes.events} className={s.cardLink}>
            {t.nav_events}
          </Link>
        </div>
      </section>

      <section className={s.give} aria-labelledby="c-give">
        <div className={s.giveBody}>
          <h2 id="c-give" className={s.giveH2}>
            {t.hm_c_give_title}
          </h2>
          <p>{t.hm_c_give_desc}</p>
          <div className={s.actions}>
            <Link href={`${routes.donate}?fund=new-bmcc`} className={s.btnCream}>
              {t.hm_give_now}
            </Link>
            <Link href={routes.newBmcc} className={s.giveLink}>
              {t.nb_about_project}
            </Link>
          </div>
        </div>
        <Pattern className={s.giveArt} />
      </section>
    </div>
  );
}
