import { test, expect, type Browser } from "@playwright/test";
import { roleState } from "./helpers";

// Phase 9: Admin → Site text, Settings and Media library.
const uid = () => Date.now().toString(36);

async function as(browser: Browser, role: string) {
  const context = await browser.newContext({ storageState: roleState(role) });
  return { context, page: await context.newPage() };
}

test("site text: an editor changes the Home heading in English and Urdu, placeholders are protected, reset restores it", async ({ browser, baseURL }) => {
  const { context, page } = await as(browser, "editor");
  const heading = `E2E heading ${uid()}`;

  await page.goto("/admin/content?q=digital+home+prayer");
  await page.getByRole("link", { name: "A digital home for prayer, giving, and belonging." }).click();
  await expect(page).toHaveURL(/\/admin\/content\/home_heading$/);
  await page.getByLabel("English (US)").fill(heading);
  await page.getByLabel("Urdu").fill(`E2E اردو ${uid()}`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. The site shows the new text now.");

  const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const v = await visitor.newPage();
  await v.goto("/");
  await expect(v.getByRole("heading", { level: 1 })).toHaveText(heading);
  await visitor.addCookies([{ name: "bmcc_lang", value: "urdu", domain: new URL(baseURL!).hostname, path: "/" }]);
  await v.reload();
  await expect(v.getByRole("heading", { level: 1 })).toHaveText(/^E2E اردو/);

  // The list shows which languages were edited.
  await page.goto("/admin/content?edited=1&q=digital");
  await expect(page.getByRole("row", { name: new RegExp(heading) })).toContainText("English (US), Urdu");

  // Reset brings back the built-in text everywhere.
  await page.goto("/admin/content/home_heading");
  await page.getByRole("button", { name: "Reset to the built-in text (all languages)" }).click();
  await expect(page.getByText("Back to the built-in text in every language.")).toBeVisible();
  await expect(page.getByLabel("English (US)")).toHaveValue("A digital home for prayer, giving, and belonging.");
  await v.goto("/");
  await visitor.clearCookies();
  await v.reload();
  await expect(v.getByRole("heading", { level: 1 })).toHaveText("A digital home for prayer, giving, and belonging.");
  await visitor.close();

  // A placeholder the site fills in can't be removed.
  await page.goto("/admin/content/acct_greeting");
  await expect(page.getByText("in every language — the site fills it in")).toBeVisible();
  await page.getByLabel("Spanish").fill("E2E Hola");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText("Spanish: keep the placeholders exactly as they are ({name})");
  await context.close();
});

test("settings: a super admin changes the phone shown in the footer; bad values are refused; editors can't open Settings", async ({ page, browser }) => {
  await page.goto("/admin/settings");
  const phone = page.getByLabel("Phone (as shown)");
  await phone.fill("925-555-0100 (E2E)");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. The site uses the new settings now.");
  await page.goto("/");
  await expect(page.locator("footer")).toContainText("925-555-0100 (E2E)");

  await page.goto("/admin/settings");
  await page.getByLabel("EIN").fill("123");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toHaveText("EIN must look like 12-3456789");

  // Empty = back to the server default.
  await page.goto("/admin/settings");
  await page.getByLabel("Phone (as shown)").fill("");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. The site uses the new settings now.");
  await page.goto("/");
  await expect(page.locator("footer")).not.toContainText("E2E");

  const { context, page: editor } = await as(browser, "editor");
  await editor.goto("/admin/settings");
  await expect(editor).toHaveURL(/denied=1/);
  await context.close();
});

test("media library: upload, put a photo on About Us, can't delete it while used, remove and delete", async ({ browser }) => {
  const { context, page } = await as(browser, "editor");
  const alt = `E2E masjid hall ${uid()}`;
  await page.goto("/admin/media");
  const upload = page.getByRole("region", { name: "Upload a photo" });

  await upload.getByLabel("Photo", { exact: true }).setInputFiles("e2e/fixtures/not-an-image.jpg");
  await upload.getByLabel(/Describe the photo/).fill(alt);
  await upload.getByRole("button", { name: "Upload" }).click();
  await expect(upload.getByRole("status")).toHaveText("The photo must be a JPEG, PNG or WebP image.");

  await upload.getByLabel("Photo", { exact: true }).setInputFiles("e2e/fixtures/event-photo.jpg");
  await upload.getByLabel(/Describe the photo/).fill(alt);
  await upload.getByRole("button", { name: "Upload" }).click();
  await expect(upload.getByRole("status")).toHaveText("Uploaded “event-photo.jpg”.");
  await page.reload();

  const slot = page.getByRole("group", { name: "About Us — “About” tab" });
  const select = slot.getByLabel("Photo for About Us — “About” tab");
  await select.selectOption((await select.locator("option", { hasText: alt }).getAttribute("value"))!);
  await slot.getByRole("button", { name: "Use this photo" }).click();
  await expect(slot.getByRole("status")).toHaveText("Photo set. The site shows it now.");

  const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const v = await visitor.newPage();
  await v.goto("/about");
  const img = v.getByRole("img", { name: alt });
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  await page.reload();
  const card = page.getByRole("article", { name: "event-photo.jpg" }).filter({ has: page.getByRole("img", { name: alt }) });
  await expect(card).toContainText("Used: About Us — “About” tab");
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Delete" }).click();
  await expect(card.getByRole("status")).toContainText("This photo is in use (About Us — “About” tab)");

  await slot.getByLabel("Photo for About Us — “About” tab").selectOption("");
  await slot.getByRole("button", { name: "Use this photo" }).click();
  await expect(slot.getByRole("status")).toHaveText("Photo removed; the placeholder shows again.");
  await v.reload();
  await expect(v.getByRole("img", { name: alt })).toHaveCount(0);
  await visitor.close();

  await page.reload();
  const mine = page.getByRole("article", { name: "event-photo.jpg" }).filter({ has: page.getByRole("img", { name: alt }) });
  await expect(mine).toContainText("Not used on the site");
  page.once("dialog", (d) => d.accept());
  await mine.getByRole("button", { name: "Delete" }).click();
  await expect(mine).toHaveCount(0);
  await context.close();
});
