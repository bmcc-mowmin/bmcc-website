import Link from "next/link";
import type { TickerItem } from "@/lib/content/announcements";
import styles from "./Header.module.css";

// Scrolls ~45s per loop, pauses on hover/focus, stops under prefers-reduced-motion.
// The track is always left-to-right; each item uses dir="auto" for its own script.
export function Ticker({ items, label }: { items: TickerItem[]; label: string }) {
  const loop = [...items, ...items];
  return (
    <div className={styles.ticker} dir="ltr" role="region" aria-label={label}>
      <span className={styles.tickerLabel}>{label}</span>
      <div className={styles.tickerViewport}>
        <div className={styles.tickerTrack}>
          {loop.map((a, i) => {
            const duplicate = i >= items.length;
            const content = (
              <>
                <span className={styles.tickerDiamond} aria-hidden>
                  ◆
                </span>
                {a.text}
              </>
            );
            // The second copy exists only for the seamless loop; hide it from screen readers and Tab.
            const common = {
              dir: "auto" as const,
              className: styles.tickerItem,
              "aria-hidden": duplicate || undefined,
              tabIndex: duplicate ? -1 : undefined,
            };
            return a.href ? (
              <Link key={`${a.id}-${i}`} href={a.href} {...common}>
                {content}
              </Link>
            ) : (
              <span key={`${a.id}-${i}`} {...common}>
                {content}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
