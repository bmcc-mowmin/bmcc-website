import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Theme preview (THEME_PREVIEW=1): the picker switches the whole public site, and every concept
// theme still meets WCAG AA (colour contrast in particular) on the main public pages.
const PAGES = ["/", "/prayer-times", "/donate", "/membership", "/events", "/new-bmcc"];

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
