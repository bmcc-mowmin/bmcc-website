import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getI18n } from "@/lib/i18n/server";
import { htmlLang } from "@/lib/i18n/config";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Brentwood Muslim Community Center", template: "%s · BMCC" },
  description:
    "Brentwood Muslim Community Center — daily prayer times, events, giving, membership and community services in Brentwood, CA.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { lang, t, dir } = await getI18n();
  return (
    <html lang={htmlLang(lang)} dir={dir} className={inter.variable}>
      <body>
        <AuthProvider lang={lang}>
          <I18nProvider value={{ lang, t, dir }}>{children}</I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
