"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import styles from "./Footer.module.css";

// "Report a problem" — tells the form which page the visitor was on.
export function ReportLink() {
  const { t } = useI18n();
  const path = usePathname();
  const href = path && path !== "/report-a-problem" ? `/report-a-problem?from=${encodeURIComponent(path)}` : "/report-a-problem";
  return (
    <Link href={href} className={styles.reportLink}>
      {t.bug_footer_link}
    </Link>
  );
}
