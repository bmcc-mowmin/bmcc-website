import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { getApprovedListings } from "@/lib/directory";
import { DirectoryBrowser } from "@/components/directory/DirectoryBrowser";
import styles from "@/components/directory/directory.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
  title: t.nav_community,
  description: t.community_paragraph,
};
}

export default async function CommunityPage({ searchParams }: PageProps<"/community">) {
  const [{ t }, listings, params] = await Promise.all([getI18n(), getApprovedListings(), searchParams]);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return (
    <section className="container section-y">
      <div className={styles.head}>
        <div style={{ maxWidth: 640 }}>
          <div className="eyebrow">{t.community_eyebrow}</div>
          <h1 className="page-h1">{t.community_heading}</h1>
          <p className="lead">{t.community_paragraph}</p>
        </div>
        <Link href="/community/submit" className={styles.submitButton}>
          {t.submit_listing}
        </Link>
      </div>

      <div className={styles.disclaimer}>
        <strong>{t.disclaimer_label}</strong> {t.disclaimer_text}
      </div>

      <DirectoryBrowser
        listings={listings}
        mapsKey={env.GOOGLE_MAPS_EMBED_API_KEY}
        initial={{ q: str(params.q), type: str(params.type), category: str(params.category), page: Math.max(1, Number(params.page) || 1), listing: str(params.listing) || null }}
      />

      <p className={styles.reviewed}>{t.reviewed_note}</p>
    </section>
  );
}
