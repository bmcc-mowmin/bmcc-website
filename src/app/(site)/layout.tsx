import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { ResubBar } from "@/components/mailing-list/ResubBar";
import { env } from "@/lib/env";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
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
