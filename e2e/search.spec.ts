import { test, expect } from "@playwright/test";
import { deleteListings, insertListing } from "./db";

// Site search: pages, services, events and directory listings, in every language.
test.use({ storageState: { cookies: [], origins: [] } });

test("header search → results page with pages, services and events", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("searchbox", { name: "Search the site…" }).fill("nikah");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=nikah/);
  const pages = page.getByRole("region", { name: /Pages & services/ });
  await expect(pages.getByRole("link", { name: "Nikah Marriage Services" })).toBeVisible();
  await expect(pages.locator("mark").first()).toHaveText(/nikah/i);

  await page.goto("/search?q=dinner");
  await expect(page.getByRole("region", { name: /Events/ }).getByRole("link", { name: /Dinner/ })).toBeVisible();

  await page.goto("/search?q=qwertyzzz");
  await expect(page.getByRole("status")).toHaveText(/Nothing found for “qwertyzzz”/);
  await expect(page.getByRole("link", { name: "Prayer Times" }).last()).toBeVisible();
});

test("directory listings are searchable; pending ones are not", async ({ page }) => {
  await insertListing({ name: "E2E Searchable Bakery", parentCategory: "Restaurant", category: "Halal Bakery", city: "Antioch" });
  await insertListing({ name: "E2E Hidden Bakery", parentCategory: "Restaurant", category: "Halal Bakery", status: "PENDING" });
  await page.goto("/search?q=e2e bakery");
  const dir = page.getByRole("region", { name: /Community Directory/ });
  await expect(dir.getByRole("link", { name: "E2E Searchable Bakery" })).toBeVisible();
  await expect(page.getByText("E2E Hidden Bakery")).toHaveCount(0);
  await dir.getByRole("link", { name: "E2E Searchable Bakery" }).click();
  await expect(page.getByRole("dialog")).toContainText("E2E Searchable Bakery");
  await deleteListings("E2E ");
});

test("search works in Urdu and Dari, and English words still find pages there", async ({ page, baseURL }) => {
  const host = new URL(baseURL!).hostname;
  await page.context().addCookies([{ name: "bmcc_lang", value: "urdu", domain: host, path: "/" }]);
  await page.goto(`/search?q=${encodeURIComponent("نماز")}`);
  await expect(page.getByRole("link", { name: "اوقاتِ نماز" }).last()).toBeVisible();
  await page.goto("/search?q=zakat");
  await expect(page.locator("main").getByRole("link").first()).toBeVisible();

  // Dari: Arabic-keyboard letters (ي/ك) still match the Persian letters (ی/ک) on the page.
  await page.context().addCookies([{ name: "bmcc_lang", value: "dari", domain: host, path: "/" }]);
  await page.goto(`/search?q=${encodeURIComponent("پیش رو")}`);
  const found = await page.locator("main").getByRole("link").count();
  await page.goto(`/search?q=${encodeURIComponent("پيش رو")}`); // Arabic ي instead of Persian ی
  await expect(page.locator("main").getByRole("link")).toHaveCount(found);
  expect(found).toBeGreaterThan(0);
});
