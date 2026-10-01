import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { AdminLoginForm } from "./AdminLoginForm";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next, error } = await searchParams;
  const user = await getCurrentUser();
  if (user && isStaff(user.adminRoles)) redirect(typeof next === "string" && next.startsWith("/admin") ? next : "/admin");
  return (
    <main className={styles.page} dir="ltr" lang="en">
      <div className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small logo */}
        <img src="/brand/bmcc-logo.jpeg" alt="Brentwood Muslim Community Center" className={styles.logo} />
        <h1 className={styles.title}>BMCC Admin</h1>
        {env.AUTH_PROVIDER === "dev" && <p className={styles.note}>Local sign-in for test and invited accounts.</p>}
        <AdminLoginForm next={typeof next === "string" ? next : undefined} forbidden={error === "forbidden"} />
      </div>
    </main>
  );
}
