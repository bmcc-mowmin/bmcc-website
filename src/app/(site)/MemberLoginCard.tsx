"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { routes } from "@/lib/routes";
import styles from "./home.module.css";

// PHASE 1: layout only (submitting does nothing). Phase 7 replaces this with the
// member sign-in (Clerk in production, the seeded test account locally).
export function MemberLoginCard() {
  const { t } = useI18n();
  return (
    <form className={styles.loginCard} onSubmit={(e) => e.preventDefault()} aria-labelledby="member-login-title">
      <h3 id="member-login-title" className={styles.loginTitle}>
        {t.login_title}
      </h3>
      <div className={styles.loginFields}>
        <label className="visually-hidden" htmlFor="login-email">
          {t.login_email}
        </label>
        <input id="login-email" type="email" autoComplete="email" placeholder={t.login_email} className={styles.loginInput} />
        <label className="visually-hidden" htmlFor="login-password">
          {t.login_password}
        </label>
        <input id="login-password" type="password" autoComplete="current-password" placeholder={t.login_password} className={styles.loginInput} />
      </div>
      <button type="submit" className={styles.loginButton}>
        {t.login_button}
      </button>
      <div className={styles.loginNew}>
        {t.login_new} <Link href={routes.membership}>{t.login_register}</Link>
      </div>
    </form>
  );
}
