import { getI18n } from "@/lib/i18n/server";
import { getActiveAnnouncements } from "@/lib/content/announcements";
import { getTodayAndTomorrow } from "@/lib/prayer/schedule";
import { HeaderClient } from "./HeaderClient";

export async function SiteHeader() {
  const { lang } = await getI18n();
  const [announcements, prayer] = await Promise.all([getActiveAnnouncements(lang), getTodayAndTomorrow(lang)]);
  return <HeaderClient announcements={announcements} prayer={prayer} />;
}
