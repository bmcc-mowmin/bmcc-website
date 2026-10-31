"use client";

import { useState } from "react";
import { SubscribeForm } from "./SubscribeForm";
import styles from "./mailing-list.module.css";

type Props = { storageKey: string; closeLabel: string; title: string; body: string; placeholder: string; button: string; done: string; signUpHref?: string };

export function ResubBarClient({ storageKey, closeLabel, title, body, placeholder, button, done, signUpHref }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {}
    document.documentElement.setAttribute("data-resub-dismissed", "");
    setDismissed(true);
    // Keep keyboard focus somewhere sensible once the bar is gone.
    document.getElementById("main")?.focus();
  };

  return (
    <section className={styles.resub} aria-labelledby="resub-title">
      <div className={`container ${styles.resubInner}`}>
        <div className={styles.resubText}>
          <p id="resub-title" className={styles.resubTitle}>
            {title}
          </p>
          <p className={styles.resubBody}>{body}</p>
        </div>
        {signUpHref ? (
          <a href={signUpHref} className={styles.resubLink}>
            {button} →
          </a>
        ) : (
          <SubscribeForm source="resub_bar" placeholder={placeholder} button={button} done={done} />
        )}
        <button type="button" onClick={dismiss} aria-label={closeLabel} className={styles.dismiss}>
          ×
        </button>
      </div>
    </section>
  );
}
