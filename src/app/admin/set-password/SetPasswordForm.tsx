"use client";

import { useActionState } from "react";
import { setPassword, type SetPasswordState } from "./actions";
import styles from "../auth.module.css";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setPassword, undefined);
  return (
    <form action={action} className={styles.form}>
      {state?.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <input type="hidden" name="token" value={token} />
      {/* Lets password managers save the right account. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <label className={styles.label} htmlFor="new-password">
        New password
      </label>
      <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required className={styles.input} />
      <p className={styles.hint}>At least 12 characters. A short sentence is easy to remember.</p>
      <label className={styles.label} htmlFor="confirm-password">
        Confirm password
      </label>
      <input id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={12} required className={styles.input} />
      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? "Saving…" : "Set password and sign in"}
      </button>
    </form>
  );
}
