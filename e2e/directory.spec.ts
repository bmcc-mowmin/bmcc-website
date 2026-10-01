import { test, expect, type Page } from "@playwright/test";
import { countListings, deleteListings } from "./db";
import { waitForEmail } from "./mailpit";

const anon = { storageState: { cookies: [], origins: [] } };
const table = (page: Page) => page.getByRole("table", { name: "Community Directory" });

test.describe("public directory", () => {
  test.use(anon);

  test("search, filters and the shareable address", async ({ page }) => {
    await page.goto("/community");
    await expect(page.getByRole("status").filter({ hasText: "Showing" })).toHaveText(/Showing 1–10 of 10 listings/);
    // Listings with a phone number come first: the two without one are last.
    const names = await table(page).getByRole("row").locator('[role="cell"]:first-child').allInnerTexts();
    expect(names.slice(-2).sort()).toEqual(["Example Pest Solutions", "Sample Computer Help"]);

    await page.getByRole("searchbox", { name: "Search the directory" }).fill("pest");
    await expect(table(page).getByRole("row")).toHaveCount(1 + 3);
    await expect(page).toHaveURL(/\?q=pest/);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByLabel("Filter by main category").selectOption("Restaurant");
    await expect(table(page).getByRole("row")).toHaveCount(2);
    // Specific categories narrow to the chosen main category.
    await expect(page.getByLabel("Filter by specific category").locator("option")).toHaveText(["All Categories", "Halal Restaurant"]);

    await page.getByRole("searchbox", { name: "Search the directory" }).fill("zzz-nothing");
    await expect(table(page).getByText("No listings match your search.")).toBeVisible();
  });

  test("View Details popup: map, keyboard, Escape and focus return", async ({ page }) => {
    await page.goto("/community");
    const opener = table(page).getByRole("row", { name: /Sample Halal Grill/ }).getByRole("button", { name: /View Details/ });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Sample Halal Grill" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("iframe")).toHaveAttribute("src", /maps\.google\.com\/maps\?q=Sample%20Halal%20Grill.*output=embed/);
    await expect(dialog.getByRole("link", { name: /Open in Google Maps/ })).toHaveAttribute("href", /maps\/search\/\?api=1&query=/);
    await expect(dialog.getByRole("link", { name: "Get Directions" })).toHaveAttribute("href", /maps\/dir\/\?api=1&destination=/);
    await expect(page).toHaveURL(/listing=/);

    // Focus stays inside the dialog while it is open.
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page).not.toHaveURL(/listing=/);

    // A listing with no address or city shows "No location provided" instead of a map.
    await table(page).getByRole("row", { name: /Sample HVAC Services/ }).getByRole("button", { name: /View Details/ }).click();
    const noMap = page.getByRole("dialog", { name: "Sample HVAC Services" });
    await expect(noMap.getByText("No location provided for this listing.")).toBeVisible();
    await noMap.getByRole("button", { name: "Close" }).click();
    await expect(noMap).toBeHidden();
  });

  test("phones get stacked cards with a full-width Call button", async ({ browser }) => {
    const context = await browser.newContext({ ...anon, viewport: { width: 375, height: 800 } });
    const page = await context.newPage();
    await page.goto("/community");
    await expect(table(page)).toBeHidden();
    const card = page.locator("article", { hasText: "Sample Halal Grill" });
    await expect(card.getByRole("link", { name: /Call/ })).toHaveAttribute("href", "tel:9255550110");
    await card.getByRole("button", { name: /View Details/ }).click();
    await expect(page.getByRole("dialog", { name: "Sample Halal Grill" })).toBeVisible();
    await context.close();
  });

  test("only approved listings are ever sent to the page", async ({ page }) => {
    await page.goto("/community?q=Pending");
    expect(await page.content()).not.toContain("Pending Sample Tutoring");
  });
});

test("a submitted listing waits for approval, then goes live, with emails to the submitter", async ({ page, browser }) => {
  await deleteListings("E2E Catering");
  const name = `E2E Catering ${Date.now().toString(36)}`;
  const submitter = `submitter-${Date.now().toString(36)}@example.com`;
  const since = new Date();

  const visitorContext = await browser.newContext(anon);
  const visitor = await visitorContext.newPage();
  await visitor.goto("/community");
  await visitor.getByRole("link", { name: "Submit a Listing" }).click();
  await expect(visitor).toHaveURL("/community/submit");

  // Missing fields → errors next to them, typed values kept.
  await visitor.getByLabel("Business or service name").fill(name);
  await visitor.waitForTimeout(2600); // the spam check rejects forms submitted in under 2.5s
  await visitor.getByRole("button", { name: "Submit for review" }).click();
  await expect(visitor.getByRole("alert").filter({ hasText: "Please check the highlighted fields." })).toBeVisible();
  await expect(visitor.getByLabel("Business or service name")).toHaveValue(name);
  await expect(visitor.getByLabel(/^Description/)).toHaveAttribute("aria-invalid", "true");

  await visitor.getByLabel("Main category").selectOption("__other");
  await visitor.getByLabel(/^New main category/).fill("Food Services");
  await visitor.getByLabel(/^Specific category/).fill("Catering");
  await visitor.getByLabel(/^Description/).fill("Halal catering for weddings and community events.");
  await visitor.getByLabel(/^Contact name/).fill("E2E Caterer");
  await visitor.getByLabel(/^Phone/).fill("925 555 0177");
  await visitor.getByLabel(/^City/).fill("Brentwood");
  await visitor.getByLabel(/^Your email/).fill(submitter);
  await visitor.getByLabel(/I confirm these details/).check();
  await visitor.waitForTimeout(2600);
  await visitor.getByRole("button", { name: "Submit for review" }).click();
  await expect(visitor.getByRole("heading", { name: "Thank you — your listing was submitted" })).toBeVisible();
  expect((await waitForEmail(submitter, since)).subject).toBe("We received your Community Directory listing");

  // Not public yet.
  await visitor.goto(`/community?q=${encodeURIComponent(name)}`);
  await expect(visitor.getByText(name)).toHaveCount(0);

  // Admin approves from the queue.
  await page.goto("/admin/directory");
  const card = page.getByRole("region", { name });
  await expect(card).toContainText("Food Services / Catering");
  await expect(card).toContainText("(925) 555-0177");
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card).toHaveCount(0); // it leaves the queue

  await visitor.goto(`/community?q=${encodeURIComponent(name)}`);
  await expect(table(visitor).getByRole("row", { name: new RegExp(name) })).toBeVisible();
  const approved = await waitForEmail(submitter, since, 10_000).then(async () => {
    // The newest email is the approval.
    const r = await fetch(`${process.env.MAILPIT_API_URL ?? "http://localhost:8025"}/api/v1/search?query=${encodeURIComponent(`to:"${submitter}"`)}`);
    return ((await r.json()) as { messages: { Subject: string }[] }).messages.map((m) => m.Subject);
  });
  expect(approved).toContain(`Your listing "${name}" is now live`);
  await visitorContext.close();

  await deleteListings(name);
});

test("spam: a filled honeypot looks successful but saves nothing", async ({ browser }) => {
  const context = await browser.newContext(anon);
  const page = await context.newPage();
  const name = `E2E Spam ${Date.now().toString(36)}`;
  await page.goto("/community/submit");
  await page.getByLabel("Business or service name").fill(name);
  await page.locator('input[name="company_fax"]').fill("bot was here");
  await page.waitForTimeout(2600);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("heading", { name: "Thank you — your listing was submitted" })).toBeVisible();
  expect(await countListings(name)).toBe(0);
  await context.close();
});

test("CSV import adds valid rows, reports bad ones, skips duplicates; paging appears past 10", async ({ page, browser }) => {
  await deleteListings("E2E");
  await page.goto("/admin/directory");
  const importer = page.locator("section", { has: page.getByRole("heading", { name: "Import listings from a CSV" }) });
  await importer.getByLabel("CSV file").setInputFiles("e2e/fixtures/listings.csv");
  await importer.getByRole("button", { name: "Import" }).click();
  await expect(importer.getByRole("status")).toContainText("Imported 2 listings as approved; skipped 0 duplicates. 1 row(s) need fixing: Row 4 (no name): name");

  await importer.getByLabel("CSV file").setInputFiles("e2e/fixtures/listings.csv");
  await importer.getByRole("button", { name: "Import" }).click();
  await expect(importer.getByRole("status")).toContainText("Imported 0 listings as approved; skipped 2 duplicates.");

  const context = await browser.newContext(anon);
  const visitor = await context.newPage();
  await visitor.goto("/community");
  await expect(visitor.getByRole("status").filter({ hasText: "Showing" })).toHaveText(/Showing 1–10 of 12 listings/);
  await visitor.getByRole("button", { name: "Page 2" }).click();
  await expect(visitor.getByRole("status").filter({ hasText: "Showing" })).toHaveText(/Showing 11–12 of 12 listings/);
  await expect(visitor).toHaveURL(/page=2/);
  await context.close();

  // Export includes them, in the import format.
  const csv = await (await page.request.get("/admin/directory/export")).text();
  expect(csv.split("\r\n")[0]).toBe("name,listing type,main category,category,tags,description,author,phone,email,website,address,city,state,zip,google map url,status,submitter email,created");
  expect(csv).toContain("E2E Import Bakery,business,Restaurant,Bakery,Halal; Bakery");

  await deleteListings("E2E Import");
});

test("directory export is refused without the directory role", async ({ browser }) => {
  const context = await browser.newContext({ storageState: "playwright/.auth/prayer.json" });
  expect((await context.request.get("/admin/directory/export")).status()).toBe(403);
  await context.close();
});
