"use client";

import { useActionState } from "react";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { useI18n } from "@/components/i18n/I18nProvider";
import { HoneypotFields } from "@/components/forms/HoneypotFields";
import { emailSignInLink, type LinkState } from "./actions";
import styles from "./login.module.css";

// "No password? Email me a sign-in link" — for members and donors (staff use their password).
// An address BMCC doesn't know gets a "not found" message with a link to become a member.
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
      {state.status === "not_found" && (
        <div role="alert" className={styles.notFound}>
          <p>{t.signin_not_found.replace("{email}", state.email)}</p>
          <Link href={routes.membership} className={styles.notFoundCta}>
            {t.btn_become_member} →
          </Link>
        </div>
      )}
      <label className={styles.label} htmlFor="signin-link-email">
        {t.login_email}
      </label>
      <input id="signin-link-email" name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={state.status === "error" || state.status === "not_found" ? state.email : ""} key={state.status} className={styles.input} />
      <button type="submit" disabled={pending} className={`${styles.button} ${styles.secondary}`}>
        {pending ? t.f_sending : t.signin_link_button}
      </button>
    </form>
  );
}
