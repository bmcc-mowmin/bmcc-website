import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { ResubBar } from "@/components/mailing-list/ResubBar";
import { getSettings } from "@/lib/settings";
import { getI18n } from "@/lib/i18n/server";
import { getTheme, themePreviewEnabled } from "@/lib/theme";
import { themeFontVars } from "@/components/theme/fonts";
import { ThemePicker } from "@/components/theme/ThemePicker";
import "./themes.css";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [{ t }, settings, theme] = await Promise.all([getI18n(), getSettings(), getTheme()]);
  return (
    <div data-theme={theme} className={theme === "current" ? undefined : themeFontVars}>
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
      {themePreviewEnabled() && <ThemePicker theme={theme} />}
    </div>
  );
}
