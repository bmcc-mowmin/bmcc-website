import { existsSync } from "node:fs";
import { test as setup, expect } from "@playwright/test";

// Signs in as the seeded admin and saves the session for every test. A still-valid saved session
// is reused, so repeated local runs don't trip the sign-in rate limit (5 tries / 10 min).
export const ADMIN_STATE = "playwright/.auth/admin.json";

setup("sign in as the seeded admin", async ({ browser }) => {
  if (existsSync(ADMIN_STATE)) {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    await page.goto("/admin/prayer-times");
    const stillSignedIn = new URL(page.url()).pathname.startsWith("/admin");
    await context.close();
    if (stillSignedIn) return;
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set in .env");
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login?next=/admin");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL(/\/admin\/prayer-times$/);
  await context.storageState({ path: ADMIN_STATE });
  await context.close();
});
