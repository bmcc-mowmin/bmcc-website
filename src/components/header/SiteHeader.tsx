import { getI18n } from "@/lib/i18n/server";
import { getActiveAnnouncements } from "@/lib/content/announcements";
import { getTodayAndTomorrow } from "@/lib/prayer/schedule";
import { getCurrentUser } from "@/lib/auth";
import { logoUrl } from "@/lib/media";
import { HeaderClient } from "./HeaderClient";

export async function SiteHeader() {
  const { lang } = await getI18n();
  const [announcements, prayer, user, logo] = await Promise.all([getActiveAnnouncements(lang), getTodayAndTomorrow(lang), getCurrentUser(), logoUrl()]);
  return <HeaderClient announcements={announcements} prayer={prayer} signedIn={!!user} logo={logo} />;
}
