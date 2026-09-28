import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/(site)/login/actions";
import { AdminNav } from "@/components/admin/AdminNav";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · BMCC Admin" }, robots: { index: false } };

// Every admin page is behind this check: signed in, and role = ADMIN.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className={styles.shell} dir="ltr" lang="en">
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size logo */}
          <img src="/brand/bmcc-logo.jpeg" alt="" />
          BMCC Admin
        </Link>
        <AdminNav />
        <div className={styles.sidebarFooter}>
          <div>{user.email}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            <Link href="/">View site</Link>
            <form action={logout}>
              <button type="submit" className={styles.linkButton}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
