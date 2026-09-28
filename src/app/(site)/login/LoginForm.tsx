"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { login, type LoginState } from "./actions";
import styles from "./login.module.css";

export function LoginForm({ next, forbidden }: { next?: string; forbidden: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const error = state?.error ? t[state.error] : forbidden ? t.login_forbidden : null;
  return (
    <form action={action} className={styles.card} aria-labelledby="login-title">
      <h1 id="login-title" className={styles.title}>
        {t.login_title}
      </h1>
      <p className={styles.note}>{t.login_dev_note}</p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <input type="hidden" name="next" value={next ?? ""} />
      <label className={styles.label} htmlFor="login-email">
        {t.login_email}
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="username"
        required
        defaultValue={state?.email}
        key={state?.email}
        className={styles.input}
      />
      <label className={styles.label} htmlFor="login-password">
        {t.login_password}
      </label>
      <input id="login-password" name="password" type="password" autoComplete="current-password" required className={styles.input} />
      <button type="submit" disabled={pending} className={styles.button}>
        {t.login_button}
      </button>
    </form>
  );
}
