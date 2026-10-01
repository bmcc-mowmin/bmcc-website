import Link from "next/link";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.not_found_title };
}

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <>
      <SiteHeader />
      <main id="main" className="container section-y" style={{ minHeight: "40vh" }}>
        <div className="eyebrow">404</div>
        <h1 className="page-h1">{t.not_found_title}</h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          {t.not_found_text}
        </p>
        <Link href="/" className="btn btn-primary">
          {t.back_home}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
