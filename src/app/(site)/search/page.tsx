import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { search, type SearchHit } from "@/lib/search";
import { queryTerms } from "@/lib/search/normalize";
import { routes } from "@/lib/routes";
import { Highlight } from "./Highlight";
import styles from "./search.module.css";

// "{q}" in a sentence, with what the person typed kept in its own direction.
function withQuery(template: string, q: string) {
  const [before, after] = template.split("{q}");
  return (
    <>
      {before}
      <bdi>{q}</bdi>
      {after}
    </>
  );
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { t } = await getI18n();
  const { q } = await searchParams;
  return { title: typeof q === "string" && q.trim() ? `${t.search_title}: \u2068${q.trim().slice(0, 60)}\u2069` : t.search_title, robots: { index: false } };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { t, lang } = await getI18n();
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw.trim().slice(0, 100) : "";
  const results = q ? await search(q, lang) : null;
  const terms = queryTerms(q);

  const group = (id: string, label: string, hits: SearchHit[]) =>
    hits.length > 0 && (
      <section className={styles.group} aria-labelledby={`results-${id}`}>
        <h2 id={`results-${id}`} className={styles.groupTitle}>
          {label} <span className={styles.count}>({hits.length})</span>
        </h2>
        <ul className={styles.hits}>
          {hits.map((h) => (
            <li key={`${h.href}|${h.title}`}>
              <Link href={h.href} className={styles.hitTitle}>
                <bdi>
                  <Highlight text={h.title} terms={terms} />
                </bdi>
              </Link>
              {h.meta && (
                <div className={styles.meta}>
                  <bdi>{h.meta}</bdi>
                </div>
              )}
              {h.snippet && (
                <p className={styles.snippet} dir="auto">
                  <Highlight text={h.snippet} terms={terms} />
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <section className={`container section-y ${styles.wrap}`}>
      <h1 className="page-h1">{t.search_title}</h1>
      <form role="search" action="/search" className={styles.form}>
        <label htmlFor="search-q" className="visually-hidden">
          {t.search_placeholder}
        </label>
        <input id="search-q" type="search" name="q" defaultValue={q} placeholder={t.search_placeholder} maxLength={100} className={styles.input} autoFocus={!q} />
        <button type="submit" className="btn btn-primary">
          {t.search_button}
        </button>
      </form>
      {!results && <p className={styles.hint}>{t.search_hint}</p>}
      {results && (
        <>
          <p className={styles.summary} role="status">
            {withQuery(results.total > 0 ? t.search_results_for.replace("{n}", String(results.total)) : t.search_none, q)}
          </p>
          {results.total === 0 && (
            <ul className={styles.suggestions}>
              {[
                [routes.prayerTimes, t.nav_prayer],
                [routes.events, t.nav_events],
                [routes.community, t.nav_community],
                [routes.services, t.nav_services],
                [routes.donate, t.nav_donate],
                [routes.contact, t.nav_contact],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          )}
          {group("pages", t.search_pages, results.pages)}
          {group("events", t.search_events, results.events)}
          {group("directory", t.nav_community, results.directory)}
        </>
      )}
    </section>
  );
}
