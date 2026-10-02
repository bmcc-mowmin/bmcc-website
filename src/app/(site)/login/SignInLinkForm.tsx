"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { HoneypotFields } from "@/components/forms/HoneypotFields";
import { emailSignInLink, type LinkState } from "./actions";
import styles from "./login.module.css";

// "No password? Email me a sign-in link" — for members and donors (staff use their password).
export function SignInLinkForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<LinkState, FormData>(emailSignInLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className={styles.card} role="status">
        <h2 className={styles.subtitle}>{t.signin_link_sent_title}</h2>
        <p className={styles.note} style={{ margin: 0 }}>
          {t.signin_link_sent_text.replace("{email}", state.email)}
        </p>
      </div>
    );
  }
  return (
    <form action={action} className={styles.card} aria-labelledby="signin-link-title">
      <h2 id="signin-link-title" className={styles.subtitle}>
        {t.signin_link_title}
      </h2>
      <p className={styles.note}>{t.signin_link_text}</p>
      <HoneypotFields />
      <input type="hidden" name="next" value={next ?? ""} />
      {state.status === "error" && (
        <p role="alert" className={styles.error}>
          {t[state.error]}
        </p>
      )}
      <label className={styles.label} htmlFor="signin-link-email">
        {t.login_email}
      </label>
      <input id="signin-link-email" name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={state.status === "error" ? state.email : ""} key={state.status} className={styles.input} />
      <button type="submit" disabled={pending} className={`${styles.button} ${styles.secondary}`}>
        {pending ? t.f_sending : t.signin_link_button}
      </button>
    </form>
  );
}
