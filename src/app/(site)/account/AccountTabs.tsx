"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./account.module.css";

export function AccountTabs({ tabs, label }: { tabs: { href: string; label: string }[]; label: string }) {
  const path = usePathname();
  const active = (href: string) => (href === "/account" ? path === href : path.startsWith(href));
  return (
    <nav className={styles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={`${styles.tab} ${active(tab.href) ? styles.tabActive : ""}`} aria-current={active(tab.href) ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
