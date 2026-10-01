import { existsSync } from "node:fs";
import { test as setup, expect, type Browser } from "@playwright/test";
import { ADMIN_STATE, roleState } from "./helpers";
import { cleanTestData, resetRateLimits } from "./db";

// Signs in once per seeded account and saves each session for the tests. A still-valid saved
// session is reused, so repeated local runs don't trip the sign-in rate limit.

async function signIn(browser: Browser, email: string, password: string, statePath: string) {
  if (existsSync(statePath)) {
    const context = await browser.newContext({ storageState: statePath });
    const page = await context.newPage();
    await page.goto("/admin");
    const stillSignedIn = new URL(page.url()).pathname === "/admin";
    await context.close();
    if (stillSignedIn) return;
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await context.storageState({ path: statePath });
  await context.close();
}

setup("sign in as the seeded accounts", async ({ browser }) => {
  // Tests submit public forms repeatedly from one address; start each run with fresh rate limits.
  await resetRateLimits();
  await cleanTestData();
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_STAFF_PASSWORD } = process.env;
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD || !SEED_STAFF_PASSWORD) {
    throw new Error("SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD and SEED_STAFF_PASSWORD must be set in .env (npm run setup)");
  }
  await signIn(browser, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, ADMIN_STATE);
  for (const role of ["editor", "prayer", "treasurer", "membership"]) {
    await signIn(browser, `${role}@bmcc.local`, SEED_STAFF_PASSWORD, roleState(role));
  }
});
