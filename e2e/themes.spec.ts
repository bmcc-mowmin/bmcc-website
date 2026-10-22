import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Theme preview (THEME_PREVIEW=1): the picker switches the whole public site, and every concept
// theme still meets WCAG AA (colour contrast in particular) on the main public pages.
const PAGES = ["/", "/about", "/prayer-times", "/donate", "/membership", "/events", "/new-bmcc"];

test("the picker switches the theme and remembers it", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/");
  const picker = page.getByLabel("Theme preview");
  test.skip((await picker.count()) === 0, "THEME_PREVIEW is off");
  await expect(page.locator("[data-theme]")).toHaveAttribute("data-theme", "current");
  await picker.selectOption("irvine");
  await expect(page.locator("[data-theme]")).toHaveAttribute("data-theme", "irvine");
  await page.goto("/new-bmcc");
  await expect(page.locator("[data-theme]")).toHaveAttribute("data-theme", "irvine");
  await context.close();
});

for (const theme of ["cambridge", "zayed", "irvine"]) {
  test(`accessibility in theme ${theme}`, async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    await context.addCookies([{ name: "bmcc_theme", value: theme, domain: new URL(baseURL!).hostname, path: "/" }]);
    const page = await context.newPage();
    await page.goto("/");
    test.skip((await page.locator(`[data-theme="${theme}"]`).count()) === 0, "THEME_PREVIEW is off");
    const found: Record<string, string[]> = {};
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      if (violations.length) found[path] = violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    }
    expect(found).toEqual({});
    await context.close();
  });
}

for (const theme of ["cambridge", "zayed", "irvine"]) {
  test(`theme ${theme} has its own Home layout with today's prayers, fits a phone, and keeps land photos off Home`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: "bmcc_theme", value: theme, domain: new URL(baseURL!).hostname, path: "/" }]);
    const page = await context.newPage();
    await page.goto("/");
    test.skip((await page.locator(`[data-theme="${theme}"]`).count()) === 0, "THEME_PREVIEW is off");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("main").getByRole("table", { name: "Prayer" }).first()).toContainText("Fajr");
    // The full menu still fits on a desktop screen.
    await expect(page.getByRole("navigation", { name: /main/i }).getByRole("link", { name: "Prayer Times" })).toBeVisible();
    // Land photos (New BMCC collection) never appear on Home.
    const landAlts = (await page.request.get("/new-bmcc").then((r) => r.text())).match(/alt="Aerial[^"]*"/g) ?? [];
    for (const alt of landAlts) await expect(page.locator(`main img[${alt}]`)).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 800 });
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await context.close();
  });
}
