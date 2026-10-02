import type { Metadata } from "next";
import { logoUrl } from "@/lib/media";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { ClerkSignIn, ClerkSignUp } from "@/components/auth/ClerkScreens";
import { SignOut } from "@/components/auth/SignOut";
import { adminLogout } from "./actions";
import { AdminLoginForm } from "./AdminLoginForm";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const logo = await logoUrl();
  const { next, error, mode } = await searchParams;
  const user = await getCurrentUser();
  if (user && isStaff(user.adminRoles)) redirect(typeof next === "string" && next.startsWith("/admin") ? next : "/admin");
  return (
    <main className={styles.page} dir="ltr" lang="en">
      <div className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small logo */}
        <img src={logo} alt="Brentwood Muslim Community Center" className={styles.logo} />
        <h1 className={styles.title}>BMCC Admin</h1>
        {env.AUTH_PROVIDER === "dev" && <p className={styles.note}>Local sign-in for test and invited accounts.</p>}
        {env.AUTH_PROVIDER === "dev" && <AdminLoginForm next={typeof next === "string" ? next : undefined} forbidden={error === "forbidden"} />}
        {env.AUTH_PROVIDER === "clerk" &&
          (user ? (
            // Signed in, but this account has no admin role.
            <>
              <p className={styles.error} role="alert">
                {user.email} doesn&apos;t have admin access. Sign out and sign in with your admin account, or ask a Super admin to invite this email.
              </p>
              <SignOut action={adminLogout} label="Sign out" className={styles.button} redirectUrl="/admin/login" />
            </>
          ) : mode === "sign-up" ? (
            <>
              <p className={styles.note}>First time? Create your login with the email address your invitation was sent to.</p>
              <ClerkSignUp redirectTo="/admin" signInUrl="/admin/login" />
            </>
          ) : (
            <>
              <ClerkSignIn redirectTo={typeof next === "string" && next.startsWith("/admin") ? next : "/admin"} signUpUrl="/admin/login?mode=sign-up" />
              <p className={styles.note} style={{ marginTop: 12 }}>
                Invited, but no login yet? <a href="/admin/login?mode=sign-up">Create your login</a>
              </p>
            </>
          ))}
      </div>
    </main>
  );
}
