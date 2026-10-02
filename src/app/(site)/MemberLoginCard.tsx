"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { routes } from "@/lib/routes";
import { login, type LoginState } from "./login/actions";
import styles from "./home.module.css";

// Home "Member Portal" card: signs in with a password, or links to the emailed-link option.
// Signed-in visitors get a link to their account instead.
export function MemberLoginCard({ signedIn, name, clerk }: { signedIn: boolean; name?: string | null; clerk: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);

  if (signedIn) {
    return (
      <div className={styles.loginCard}>
        <h3 className={styles.loginTitle}>
          {name ? (
            <>
              {t.home_welcome_back.split("{name}")[0]}
              <bdi>{name}</bdi>
              {t.home_welcome_back.split("{name}")[1]}
            </>
          ) : (
            t.nav_my_account
          )}
        </h3>
        <Link href={routes.account} className={styles.loginButton} style={{ textAlign: "center", display: "block" }}>
          {t.home_go_account}
        </Link>
      </div>
    );
  }
  if (clerk) {
    // Clerk: its sign-in and sign-up screens are on /login and /sign-up.
    return (
      <div className={styles.loginCard}>
        <h3 className={styles.loginTitle}>{t.login_title}</h3>
        <Link href={`${routes.memberLogin}?next=${routes.account}`} className={styles.loginButton} style={{ textAlign: "center", display: "block" }}>
          {t.login_button}
        </Link>
        <div className={styles.loginNew}>
          {t.login_new} <Link href="/sign-up">{t.create_account}</Link>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className={styles.loginCard} aria-labelledby="member-login-title">
      <h3 id="member-login-title" className={styles.loginTitle}>
        {t.login_title}
      </h3>
      <input type="hidden" name="next" value={routes.account} />
      {state?.error && (
        <p role="alert" className={styles.loginError}>
          {t[state.error]}
        </p>
      )}
      <div className={styles.loginFields}>
        <label className="visually-hidden" htmlFor="login-email">
          {t.login_email}
        </label>
        <input id="login-email" name="email" type="email" autoComplete="username" required defaultValue={state?.email} key={state?.email} placeholder={t.login_email} className={styles.loginInput} />
        <label className="visually-hidden" htmlFor="login-password">
          {t.login_password}
        </label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" required placeholder={t.login_password} className={styles.loginInput} />
      </div>
      <button type="submit" disabled={pending} className={styles.loginButton}>
        {t.login_button}
      </button>
      <div className={styles.loginNew}>
        <Link href="/login#signin-link-title">{t.signin_link_button}</Link>
      </div>
      <div className={styles.loginNew}>
        {t.login_new} <Link href={routes.membership}>{t.login_register}</Link>
      </div>
    </form>
  );
}
