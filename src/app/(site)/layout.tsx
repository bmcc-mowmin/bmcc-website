import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { ResubBar } from "@/components/mailing-list/ResubBar";
import { getSettings } from "@/lib/settings";
import { getI18n } from "@/lib/i18n/server";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [{ t }, settings] = await Promise.all([getI18n(), getSettings()]);
  return (
    <>
      <a href="#main" className="skip-link">
        {t.skip_to_content}
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {/* During the re-subscribe campaign the bar can show on every page (otherwise Home only). */}
        {settings.showResubBarSitewide && <ResubBar />}
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
