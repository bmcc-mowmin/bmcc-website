import { expect, type Page } from "@playwright/test";

// Tests run already signed in as admin (see auth.setup.ts); this just opens an admin page and
// fails clearly if the session is missing.
export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/prayer-times");
  await expect(page).toHaveURL(/\/admin\/prayer-times/);
}

// Masjid-local "YYYY-MM-DD" n days from today.
export function masjidDate(daysFromToday = 0) {
  const d = new Date(Date.now() + daysFromToday * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;
