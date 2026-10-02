"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import styles from "./about.module.css";

export type AboutTab = {
  id: string;
  label: string;
  title: string;
  body: string[];
  list: string[];
  cta?: { label: string; href: string };
  imageLabel: string;
  // A photo from the media library, or null for the placeholder.
  image: { url: string; alt: string } | null;
};

// WAI-ARIA tabs: arrow keys move between tabs, Home/End jump to the ends.
export function AboutTabs({ tabs }: { tabs: AboutTab[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const rtl = document.documentElement.dir === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    let next = -1;
    if (step) next = (index + step + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <>
      <div role="tablist" className={styles.tabs}>
        {tabs.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${uid}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`${styles.tab} ${selected ? styles.tabActive : ""}`}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${current.id}`} className={styles.panel}>
        <div>
          <h2 className={styles.panelTitle}>{current.title}</h2>
          {current.body.map((p) => (
            <p key={p} className={styles.panelP}>
              {p}
            </p>
          ))}
          <ul className={styles.panelList}>
            {current.list.map((item) => (
              <li key={item}>
                <span aria-hidden>·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {current.cta && (
            <Link href={current.cta.href} className={`btn btn-dark ${styles.panelCta}`}>
              {current.cta.label}
            </Link>
          )}
        </div>
        {current.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo
          <img src={current.image.url} alt={current.image.alt} className={`${styles.panelPhoto} ${styles.panelImg}`} />
        ) : (
          <div className={`photo-placeholder ${styles.panelPhoto}`} role="img" aria-label={current.imageLabel}>
            {current.imageLabel}
          </div>
        )}
      </div>
    </>
  );
}
