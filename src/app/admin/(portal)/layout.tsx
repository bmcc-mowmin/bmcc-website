import type { Metadata } from "next";
import { logoUrl } from "@/lib/media";
import { SignOut } from "@/components/auth/SignOut";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { navFor, ROLE_INFO } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { adminLogout } from "../login/actions";
import { AdminNav } from "@/components/admin/AdminNav";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · BMCC Admin" }, robots: { index: false } };

// Every portal page is behind this: signed in, not disabled, at least one admin role.
// Each page and server action additionally checks its own section (requireSection).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const logo = await logoUrl();
  const user = await requireStaff();
  const nav = navFor(user.adminRoles).map(({ href, label, built }) => ({ href, label, built }));
  return (
    <div className={styles.shell} dir="ltr" lang="en">
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size logo */}
          <img src={logo} alt="" />
          BMCC Admin
        </Link>
        <AdminNav items={nav} />
        <div className={styles.sidebarFooter}>
          <div style={{ fontWeight: 700, color: "#eef2f8" }}>{user.name ?? user.email}</div>
          <div className={styles.roleList}>{user.adminRoles.map((r) => ROLE_INFO[r].label).join(" · ")}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <a href={env.APP_URL}>View site</a>
            <SignOut action={adminLogout} label="Sign out" className={styles.linkButton} redirectUrl="/admin/login" />
          </div>
        </div>
      </aside>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
