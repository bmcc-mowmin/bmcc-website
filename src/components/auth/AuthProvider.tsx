import { ClerkProvider } from "@clerk/nextjs";
import { enUS, esMX, faIR } from "@clerk/localizations";
import { env } from "@/lib/env";
import type { Lang } from "@/lib/i18n/config";

// Wraps the site in Clerk when AUTH_PROVIDER=clerk (nothing to do for the local dev login).
// Clerk's own sign-in screens come in English, Spanish and Persian (used for Dari); Clerk has no
// Urdu or Pashto, so those show its English screens.
const CLERK_LOCALIZATION: Partial<Record<Lang, typeof enUS>> = { en: enUS, spanish: esMX, dari: faIR };

export function AuthProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  if (env.AUTH_PROVIDER !== "clerk") return children;
  return (
    <ClerkProvider
      localization={CLERK_LOCALIZATION[lang] ?? enUS}
      appearance={{
        variables: { colorPrimary: "#101d33", colorForeground: "#101828", fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", borderRadius: "8px" },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
