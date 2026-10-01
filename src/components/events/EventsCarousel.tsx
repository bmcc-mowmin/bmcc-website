"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./EventsCarousel.module.css";

export type CarouselCard = {
  slug: string;
  title: string;
  description: string;
  tag: string;
  location: string;
  imageUrl: string | null;
  date: string;
  time: string;
};

const SPEED = 32; // px per second, as in the prototype
const GAP = 20;

// Drifts continuously and loops seamlessly (the list is rendered twice; the scroll position wraps
// where the second copy starts). Arrows move one card. Pauses on hover, keyboard focus, touch and
// when the tab is hidden; never moves under prefers-reduced-motion.
export function EventsCarousel({ cards, readMore, prevLabel, nextLabel }: { cards: CarouselCard[]; readMore: string; prevLabel: string; nextLabel: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const state = useRef({ paused: false, holdUntil: 0, pos: 0 });
  const touchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Where the second copy begins = one full loop.
  const loopWidth = () => {
    const el = trackRef.current;
    const firstCopy = el?.querySelector<HTMLElement>(`[data-copy="1"]`);
    return el && firstCopy ? firstCopy.offsetLeft - (el.firstElementChild as HTMLElement).offsetLeft : 0;
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const el = trackRef.current;
      const s = state.current;
      if (el) {
        const loop = loopWidth();
        if (s.paused || document.hidden || now < s.holdUntil) {
          s.pos = el.scrollLeft; // pick up wherever arrows or a swipe left it
        } else if (loop > 0 && el.scrollWidth > el.clientWidth) {
          s.pos += (SPEED * dt) / 1000;
          if (s.pos >= loop) s.pos -= loop;
          el.scrollLeft = s.pos;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const step = (sign: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const width = card ? card.getBoundingClientRect().width + GAP : el.clientWidth;
    const loop = loopWidth();
    let target = el.scrollLeft + width * sign;
    if (loop > 0) {
      if (target < 0) {
        el.scrollLeft += loop;
        target += loop;
      }
      if (target >= loop) {
        el.scrollLeft -= loop;
        target -= loop;
      }
    }
    state.current.pos = target;
    state.current.holdUntil = performance.now() + 900;
    el.scrollTo({ left: target, behavior: "smooth" });
  };

  const pause = () => (state.current.paused = true);
  const resume = () => (state.current.paused = false);

  const renderCard = (c: CarouselCard, copy: 0 | 1) => (
    <article
      key={`${c.slug}-${copy}`}
      data-card
      data-copy={copy === 1 && c === cards[0] ? "1" : undefined}
      className={styles.card}
      aria-hidden={copy === 1 || undefined}
    >
      <div className={styles.media}>
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, sized by CSS
          <img src={c.imageUrl} alt="" className={styles.image} loading="lazy" />
        ) : null}
        <span className={styles.tag}>{c.tag}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>
            <span aria-hidden>📅 </span>
            {c.date}
          </span>
          {c.time && (
            <span>
              <span aria-hidden>🕒 </span>
              {c.time}
            </span>
          )}
        </div>
        <h3 className={styles.title}>{c.title}</h3>
        <p className={styles.description}>{c.description}</p>
        <div className={styles.location}>
          <span aria-hidden>📍 </span>
          {c.location}
        </div>
      </div>
      <div className={styles.footer}>
        <Link href={`/events/${c.slug}`} className={styles.readMore} tabIndex={copy === 1 ? -1 : undefined}>
          {readMore} <span aria-hidden>→</span>
          <span className="visually-hidden">: {c.title}</span>
        </Link>
      </div>
    </article>
  );

  return (
    <div
      className={styles.wrap}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onTouchStart={() => {
        clearTimeout(touchTimer.current);
        pause();
      }}
      onTouchEnd={() => {
        touchTimer.current = setTimeout(resume, 2500);
      }}
    >
      <button type="button" className={`${styles.arrow} ${styles.prev}`} onClick={() => step(-1)} aria-label={prevLabel}>
        ‹
      </button>
      <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => step(1)} aria-label={nextLabel}>
        ›
      </button>
      <div ref={trackRef} className={styles.track} dir="ltr">
        {cards.map((c) => renderCard(c, 0))}
        {cards.map((c) => renderCard(c, 1))}
      </div>
    </div>
  );
}
