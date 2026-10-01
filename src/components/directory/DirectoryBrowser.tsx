"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { PublicListing } from "@/lib/directory";
import { ListingDialog } from "./ListingDialog";
import styles from "./directory.module.css";

const PER_PAGE = 10;

export type DirectoryFilters = { q: string; type: string; category: string; page: number; listing: string | null };

// Free-text search across name, category, main category, location and tags; main-category and
// specific-category filters; 10 per page. The current filters are kept in the address bar so a
// filtered view (or an open listing) can be shared.
export function DirectoryBrowser({ listings, initial, mapsKey }: { listings: PublicListing[]; initial: DirectoryFilters; mapsKey?: string }) {
  const { t } = useI18n();
  const [f, setF] = useState(initial);

  const update = (patch: Partial<DirectoryFilters>) => {
    const next = { ...f, ...patch };
    setF(next);
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.type) params.set("type", next.type);
    if (next.category) params.set("category", next.category);
    if (next.page > 1) params.set("page", String(next.page));
    if (next.listing) params.set("listing", next.listing);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const parents = useMemo(() => [...new Set(listings.map((l) => l.parentCategory))].sort(), [listings]);
  // Specific categories narrow to the chosen main category.
  const categories = useMemo(
    () => [...new Set(listings.filter((l) => !f.type || l.parentCategory === f.type).map((l) => l.category))].sort(),
    [listings, f.type],
  );

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return listings.filter((l) => {
      if (f.type && l.parentCategory !== f.type) return false;
      if (f.category && l.category !== f.category) return false;
      if (!q) return true;
      return [l.name, l.category, l.parentCategory, l.city ?? "", l.state ?? "", ...l.tags].join(" ").toLowerCase().includes(q);
    });
  }, [listings, f.q, f.type, f.category]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(f.page, pages);
  const start = (page - 1) * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);
  const selected = f.listing ? (listings.find((l) => l.id === f.listing) ?? null) : null;
  const hasFilters = !!(f.q || f.type || f.category);
  const tel = (p: string) => `tel:${p.replace(/[^0-9+]/g, "")}`;
  const open = (id: string) => update({ listing: id });

  return (
    <>
      <div className={styles.filters} role="search">
        <div className={styles.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#98a2b3" strokeWidth="2.3" strokeLinecap="round" aria-hidden className={styles.searchIcon}>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.4" y2="16.4" />
          </svg>
          <input
            type="search"
            value={f.q}
            onChange={(e) => update({ q: e.target.value, page: 1 })}
            placeholder={t.search_directory}
            aria-label={t.dir_search_label}
            className={styles.search}
          />
        </div>
        <select value={f.type} onChange={(e) => update({ type: e.target.value, category: "", page: 1 })} aria-label={t.dir_type_label} className={styles.select}>
          <option value="">{t.all_types}</option>
          {parents.map((p) => (
            <option key={p} value={p} dir="auto">
              {p}
            </option>
          ))}
        </select>
        <select value={f.category} onChange={(e) => update({ category: e.target.value, page: 1 })} aria-label={t.dir_category_label} className={styles.select}>
          <option value="">{t.all_categories}</option>
          {categories.map((c) => (
            <option key={c} value={c} dir="auto">
              {c}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button type="button" className={styles.clear} onClick={() => update({ q: "", type: "", category: "", page: 1 })}>
            {t.clear_filters}
          </button>
        )}
      </div>

      <div className={styles.count} role="status" aria-live="polite">
        {t.showing_label} {filtered.length === 0 ? "0" : `${start + 1}–${start + slice.length}`} {t.of_label} {filtered.length} {t.listings_label}
      </div>

      {/* Phones (≤700px): stacked cards */}
      <div className={styles.cards}>
        {slice.map((l) => (
          <article key={l.id} className={styles.card}>
            <div className={styles.cardHead}>
              <div style={{ minWidth: 0 }}>
                <h3 className={styles.cardName}>
                  <bdi>{l.name}</bdi>
                </h3>
                <div className={styles.cardCategory}>
                  <bdi>{l.category}</bdi>
                </div>
              </div>
              {l.city && <span className={styles.cardLocation}>📍 <bdi>{l.city}</bdi></span>}
            </div>
            {l.tags.length > 0 && (
              <div className={styles.tags}>
                {l.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    <bdi>{tag}</bdi>
                  </span>
                ))}
              </div>
            )}
            <div className={styles.cardButtons} style={{ gridTemplateColumns: l.phone ? "1fr 1.4fr" : "1fr" }}>
              {l.phone && (
                <a href={tel(l.phone)} className={styles.callButton}>
                  ☎ {t.call}
                </a>
              )}
              <button type="button" className={styles.detailsButton} onClick={() => open(l.id)}>
                {t.view_details}
                <span className="visually-hidden">
                  : <bdi>{l.name}</bdi>
                </span>
              </button>
            </div>
          </article>
        ))}
        {slice.length === 0 && <div className={styles.empty}>{t.no_results}</div>}
      </div>

      {/* Wider screens: table */}
      <div className={styles.table} role="table" aria-label={t.community_heading}>
        <div role="rowgroup">
          <div role="row" className={`${styles.row} ${styles.headRow}`}>
            <div role="columnheader">{t.th_name}</div>
            <div role="columnheader">{t.th_category}</div>
            <div role="columnheader">{t.th_location}</div>
            <div role="columnheader">{t.th_tags}</div>
            <div role="columnheader">{t.th_phone}</div>
            <div role="columnheader">
              <span className="visually-hidden">{t.view_details}</span>
            </div>
          </div>
        </div>
        <div role="rowgroup">
          {slice.map((l, i) => (
            <div role="row" key={l.id} className={`${styles.row} ${i % 2 ? styles.rowAlt : ""}`}>
              <div role="cell" className={styles.name}>
                <bdi>{l.name}</bdi>
              </div>
              <div role="cell" className={styles.cellText}>
                <bdi>{l.category}</bdi>
              </div>
              <div role="cell" className={styles.cellText}>
                {l.city ? <bdi>{l.city}</bdi> : "—"}
              </div>
              <div role="cell" className={styles.tags}>
                {l.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    <bdi>{tag}</bdi>
                  </span>
                ))}
              </div>
              <div role="cell" className={styles.phone}>
                {l.phone ? <a href={tel(l.phone)}>
                    <bdi dir="ltr">{l.phone}</bdi>
                  </a> : <span className={styles.dash}>—</span>}
              </div>
              <div role="cell" className={styles.actionCell}>
                <button type="button" className={styles.rowButton} onClick={() => open(l.id)}>
                  {t.view_details}
                  <span className="visually-hidden">
                  : <bdi>{l.name}</bdi>
                </span>
                </button>
              </div>
            </div>
          ))}
        </div>
        {slice.length === 0 && <div className={styles.empty}>{t.no_results}</div>}
      </div>

      {pages > 1 && (
        <nav className={styles.pagination} aria-label={t.page_label}>
          <button type="button" className={styles.pageButton} disabled={page === 1} onClick={() => update({ page: page - 1 })} aria-label={t.prev_page}>
            ‹
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.pageButton} ${n === page ? styles.pageCurrent : ""}`}
              aria-current={n === page ? "page" : undefined}
              aria-label={`${t.page_label} ${n}`}
              onClick={() => update({ page: n })}
            >
              {n}
            </button>
          ))}
          <button type="button" className={styles.pageButton} disabled={page === pages} onClick={() => update({ page: page + 1 })} aria-label={t.next_page}>
            ›
          </button>
        </nav>
      )}

      <ListingDialog listing={selected} onClose={() => update({ listing: null })} mapsKey={mapsKey} />
    </>
  );
}
