import { test, expect, type Page } from "@playwright/test";
import { roleState } from "./helpers";

// No English slips onto translated pages. Opens every public page (plus the mobile menu and a
// service popup) in each right-to-left language and fails on any visible text, screen-reader label
// or page title containing English words. Content people enter (directory listings, announcements)
// is wrapped in <bdi>/dir="auto" and skipped.

const PAGES = ["/", "/about", "/services", "/assistance", "/funeral-services", "/prayer-times", "/events", "/events/friday-jumuah", "/community", "/community/submit", "/donate", "/membership", "/subscribe/confirm", "/unsubscribe", "/no-such-page", "/login", "/login/link", "/search", "/search?q=nikah", "/events/community-dinner", "/new-bmcc"];
// Signed in as the seeded member.
const MEMBER_PAGES = ["/account", "/account/household", "/account/giving", "/account/events", "/events/community-dinner"];
// Words that are the same in every language: names, brands, prayer names, units.
const ALLOWED = /^(TEST01|BMCC|Brentwood|Muslim|Community|Center|Lone|Tree|Way|CA|AM|PM|Google|Maps|iCal|Stripe|Zelle|PayPal|Jumu['’]?ah|Fajr|Dhuhr|Asr|Maghrib|Isha|Adhan|Iqamah|Hikmah|ISNA|Hanafi|English|US|Dari|Urdu|Pashtu|Spanish|USD|PDF|env)$/i;

async function englishOnPage(page: Page) {
  const texts = await page.evaluate(() => {
    const out = new Set<string>();
    const skip = (el: Element) => el.closest("bdi, [dir=auto], script, style, noscript, [aria-hidden=true], [data-honeypot]");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      const text = walker.currentNode.textContent?.trim();
      if (el && text && !skip(el) && getComputedStyle(el).visibility !== "hidden") out.add(text);
    }
    for (const el of document.querySelectorAll("[aria-label], [placeholder], [alt], [title]")) {
      if (skip(el)) continue;
      for (const a of ["aria-label", "placeholder", "alt", "title"]) {
        const v = el.getAttribute(a);
        if (v) out.add(v);
      }
    }
    out.add(document.title.replace(/\u2068[^\u2069]*\u2069/g, "")); // text in isolate marks is what someone typed
    return [...out];
  });
  return texts.filter((t) => {
    const words = t.replace(/\S+@\S+|\S+\.(com|org)\b/g, "").match(/[A-Za-z][A-Za-z'’]*/g) ?? [];
    return words.some((w) => w.length > 1 && !ALLOWED.test(w));
  });
}

for (const lang of ["urdu", "dari", "pashto"]) {
  test(`no English on ${lang} pages`, async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ storageState: { cookies: [{ name: "bmcc_lang", value: lang, domain: new URL(baseURL!).hostname, path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
    const page = await context.newPage();
    const found: Record<string, string[]> = {};
    for (const path of PAGES) {
      await page.goto(path);
      const english = await englishOnPage(page);
      if (english.length) found[path] = english;
    }
    await page.goto("/services");
    await page.locator("main button").first().click();
    const popup = await englishOnPage(page);
    if (popup.length) found["/services (popup)"] = popup;

    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    await page.locator("button[aria-controls$='-mobile']").click();
    const menu = await englishOnPage(page);
    if (menu.length) found["mobile menu"] = menu;

    await context.close();

    const member = await browser.newContext({ storageState: roleState("member") });
    await member.addCookies([{ name: "bmcc_lang", value: lang, domain: new URL(baseURL!).hostname, path: "/" }]);
    const mp = await member.newPage();
    for (const path of MEMBER_PAGES) {
      await mp.goto(path);
      const english = await englishOnPage(mp);
      if (english.length) found[`${path} (signed in)`] = english;
    }
    await member.close();
    expect(found).toEqual({});
  });
}
