"use client";

import { useActionState } from "react";
import { adminLogin, type AdminLoginState } from "./actions";
import styles from "../auth.module.css";

export function AdminLoginForm({ next, forbidden }: { next?: string; forbidden: boolean }) {
  const [state, action, pending] = useActionState<AdminLoginState, FormData>(adminLogin, undefined);
  const error = state?.error ?? (forbidden ? "This account doesn't have access to the admin portal." : null);
  return (
    <form action={action} className={styles.form}>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <input type="hidden" name="next" value={next ?? ""} />
      <label className={styles.label} htmlFor="admin-email">
        Email address
      </label>
      <input id="admin-email" name="email" type="email" autoComplete="username" required defaultValue={state?.email} key={state?.email} className={styles.input} />
      <label className={styles.label} htmlFor="admin-password">
        Password
      </label>
      <input id="admin-password" name="password" type="password" autoComplete="current-password" required className={styles.input} />
      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
