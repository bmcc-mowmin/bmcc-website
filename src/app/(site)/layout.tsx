import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { ResubBar } from "@/components/mailing-list/ResubBar";
import { env } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { t } = await getI18n();
  return (
    <>
      <a href="#main" className="skip-link">
        {t.skip_to_content}
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {/* During the re-subscribe campaign the bar can show on every page (otherwise Home only). */}
        {env.SHOW_RESUB_BAR_SITEWIDE && <ResubBar />}
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
