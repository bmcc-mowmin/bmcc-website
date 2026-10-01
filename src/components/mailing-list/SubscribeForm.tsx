"use client";

import { useActionState, useId } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { HoneypotFields } from "@/components/forms/HoneypotFields";
import type { Source } from "@/lib/mailing-list";
import { subscribe, type SubscribeState } from "./actions";
import styles from "./mailing-list.module.css";

// One email field + button, used by the re-subscribe bar and the "Stay Connected" band.
export function SubscribeForm({ source, placeholder, button, done }: { source: Source; placeholder: string; button: string; done: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribe, { status: "idle" });
  const id = useId();
  const variant = source === "resub_bar" ? styles.bar : styles.band;

  if (state.status === "done") {
    return (
      <div className={`${styles.done} ${variant}`} role="status">
        <span aria-hidden>✓</span> {done}
      </div>
    );
  }
  const error = state.status === "error" ? state.message : null;
  return (
    <form action={action} className={`${styles.form} ${variant}`}>
      <HoneypotFields />
      <input type="hidden" name="source" value={source} />
      <div className={styles.row}>
        <input
          key={error ?? "fresh"}
          type="email"
          name="email"
          required
          maxLength={200}
          autoComplete="email"
          defaultValue={state.status === "error" ? state.email : ""}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={styles.input}
        />
        <button type="submit" disabled={pending} className={styles.button}>
          {pending ? t.f_sending : button}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
