"use client";

import { useId, useState } from "react";
import Link from "next/link";
import styles from "./ExpandableCards.module.css";

export type ExpandableCard = {
  id: string;
  icon: string;
  title: string;
  description: string;
  detail: string;
  cta: string;
  href: string;
};

// Services and Assistance: a 2-column grid of cards; "More ▾" opens one card's detail at a time.
export function ExpandableCards({ cards, moreLabel, lessLabel }: { cards: ExpandableCard[]; moreLabel: string; lessLabel: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const uid = useId();
  return (
    <div className="g2">
      {cards.map((c) => {
        const expanded = expandedId === c.id;
        const panelId = `${uid}-${c.id}`;
        return (
          <div key={c.id} id={c.id} className={styles.card}>
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpandedId(expanded ? null : c.id)}
            >
              <span className={styles.icon} aria-hidden>
                {c.icon}
              </span>
              <span className={styles.title}>
                {c.title} <span className={styles.more}>{expanded ? lessLabel : moreLabel}</span>
              </span>
              <span className={styles.description}>{c.description}</span>
            </button>
            {expanded && (
              <div id={panelId} className={styles.panel}>
                <p className={styles.detail}>{c.detail}</p>
                <Link href={c.href} className={styles.cta}>
                  {c.cta} <span aria-hidden>→</span>
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
