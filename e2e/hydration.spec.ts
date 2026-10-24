import { test, expect } from "@playwright/test";

// No React hydration errors, including after the re-subscribe bar was closed (its inline script
// marks <html> before React loads).
for (const dismissed of [false, true]) {
  test(`no hydration errors on public pages${dismissed ? " with the re-subscribe bar closed" : ""}`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    if (dismissed) await context.addInitScript(() => sessionStorage.setItem("bmcc_resub_dismissed", "1"));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /hydrat|didn't match/i.test(m.text())) errors.push(m.text().slice(0, 200));
    });
    for (const path of ["/", "/prayer-times", "/events", "/donate", "/new-bmcc"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(errors).toEqual([]);
    await context.close();
  });
}
