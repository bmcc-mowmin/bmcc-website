import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "../login/actions";
import { SignOut } from "@/components/auth/SignOut";
import { AccountTabs } from "./AccountTabs";
import styles from "./account.module.css";

// The member portal. Each page checks sign-in itself (requireMember) so it can return there after.
export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return children;
  const name = user.name?.split(" ")[0];
  return (
    <section className={`container section-y ${styles.wrap}`}>
      <div className={`${styles.head} no-print`}>
        <div>
          <div className="eyebrow">{t.acct_title}</div>
          <h1 className={styles.h1}>
            {name ? (
              <>
                {t.acct_greeting.split("{name}")[0]}
                <bdi>{name}</bdi>
                {t.acct_greeting.split("{name}")[1]}
              </>
            ) : (
              t.acct_title
            )}
          </h1>
          <p className={styles.signedInAs}>
            <bdi>{user.email}</bdi>
          </p>
        </div>
        <SignOut action={logout} label={t.acct_sign_out} className={styles.signOut} />
      </div>
      <AccountTabs
        tabs={[
          { href: "/account", label: t.acct_tab_overview },
          { href: "/account/household", label: t.acct_tab_household },
          { href: "/account/giving", label: t.acct_tab_giving },
          { href: "/account/events", label: t.acct_tab_events },
        ]}
        label={t.acct_title}
      />
      <div className={styles.body}>{children}</div>
    </section>
  );
}
