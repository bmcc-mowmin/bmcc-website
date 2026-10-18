import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { roleState } from "./helpers";

// Accessibility (axe, WCAG 2.1 A/AA) on every page, plus the phone layout: no sideways scrolling at
// 375 px and the menu works with the keyboard.

const PUBLIC = ["/", "/about", "/services", "/assistance", "/funeral-services", "/prayer-times", "/events", "/events/community-dinner", "/community", "/community/submit", "/donate", "/membership", "/new-bmcc", "/login", "/search?q=nikah", "/subscribe/confirm", "/unsubscribe", "/no-such-page"];
const MEMBER = ["/account", "/account/household", "/account/giving", "/account/events"];
const ADMIN = ["/admin", "/admin/prayer-times", "/admin/events", "/admin/announcements", "/admin/directory", "/admin/memberships", "/admin/donations", "/admin/new-bmcc", "/admin/subscribers", "/admin/messages", "/admin/content", "/admin/media", "/admin/settings", "/admin/users", "/admin/activity"];

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

async function scan(page: Page, paths: string[]) {
  const found: Record<string, string[]> = {};
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const v = await violations(page);
    if (v.length) found[path] = v;
  }
  return found;
}

test.describe("accessibility", () => {
  test.setTimeout(180_000);

  test("public pages (English and Urdu)", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    expect(await scan(page, PUBLIC)).toEqual({});
    await context.addCookies([{ name: "bmcc_lang", value: "urdu", domain: new URL(baseURL!).hostname, path: "/" }]);
    expect(await scan(page, ["/", "/prayer-times", "/donate", "/membership", "/community"])).toEqual({});
    await context.close();
  });

  test("member pages", async ({ browser }) => {
    const context = await browser.newContext({ storageState: roleState("member") });
    expect(await scan(await context.newPage(), MEMBER)).toEqual({});
    await context.close();
  });

  test("admin pages", async ({ page }) => {
    expect(await scan(page, ADMIN)).toEqual({});
  });
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 375, height: 800 }, storageState: { cookies: [], origins: [] } });
  test.setTimeout(120_000);

  test("no page scrolls sideways at 375 px (English and Urdu)", async ({ page, baseURL }) => {
    const wide: Record<string, number> = {};
    const check = async (label: string) => {
      for (const path of PUBLIC) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 1) wide[`${label} ${path}`] = overflow;
      }
    };
    await check("en");
    await page.context().addCookies([{ name: "bmcc_lang", value: "urdu", domain: new URL(baseURL!).hostname, path: "/" }]);
    await check("urdu");
    expect(wide).toEqual({});
  });

  test("the menu opens with the keyboard and links work", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Menu" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const nav = page.getByRole("navigation", { name: "Main menu" }).last();
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Prayer Times" }).first().click();
    await expect(page).toHaveURL(/\/prayer-times$/);
  });
});

test("with 'reduce motion' on, the announcement ticker and the events carousel stay still", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/");
  const track = page.locator("[class*=EventsCarousel][class*=track]");
  const ticker = page.locator("[class*=tickerTrack]");
  const start = { scroll: await track.evaluate((el) => el.scrollLeft), ticker: await ticker.evaluate((el) => el.getBoundingClientRect().left) };
  await page.waitForTimeout(2500);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(start.scroll);
  expect(await ticker.evaluate((el) => el.getBoundingClientRect().left)).toBe(start.ticker);
  await context.close();
});
