import Link from "next/link";
import styles from "@/components/admin/admin.module.css";

export function PrayerTabs({ active }: { active: "month" | "rules" }) {
  const tabs = [
    { id: "month", href: "/admin/prayer-times", label: "Month & day overrides" },
    { id: "rules", href: "/admin/prayer-times/rules", label: "Iqamah rules, Jumu'ah & settings" },
  ];
  return (
    <nav className={styles.tabs} aria-label="Prayer times sections">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} className={`${styles.tab} ${t.id === active ? styles.tabActive : ""}`} aria-current={t.id === active ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
