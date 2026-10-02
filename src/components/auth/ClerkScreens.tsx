import { SignIn, SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { getI18n } from "@/lib/i18n/server";
import { SignOut } from "./SignOut";
import { logout } from "@/app/(site)/login/actions";
import styles from "./clerk.module.css";

// Clerk's sign-in / sign-up screens (AUTH_PROVIDER=clerk), on the site's own pages. "Hash"
// routing keeps Clerk's steps on one address (/login#/factor-one, …).

// Signed in to Clerk but not linked to BMCC (no verified email): explain instead of looping.
async function UnlinkedNotice() {
  const { userId } = await auth();
  if (!userId) return null;
  const { t } = await getI18n();
  return (
    <div className={styles.notice} role="alert">
      <p>{t.signin_unverified}</p>
      <SignOut action={logout} label={t.acct_sign_out} className={styles.signOut} redirectUrl="/login" />
    </div>
  );
}

export async function ClerkSignIn({ redirectTo, signUpUrl }: { redirectTo: string; signUpUrl: string }) {
  const notice = await UnlinkedNotice();
  return <div className={styles.wrap}>{notice ?? <SignIn routing="hash" signUpUrl={signUpUrl} fallbackRedirectUrl={redirectTo} />}</div>;
}

export async function ClerkSignUp({ redirectTo, signInUrl }: { redirectTo: string; signInUrl: string }) {
  const notice = await UnlinkedNotice();
  return <div className={styles.wrap}>{notice ?? <SignUp routing="hash" signInUrl={signInUrl} fallbackRedirectUrl={redirectTo} />}</div>;
}
