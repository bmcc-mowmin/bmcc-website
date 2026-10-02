import { test, expect } from "@playwright/test";
import { loginAsAdmin, masjidDate, unique } from "./helpers";

test("admin creates an event with a photo; it appears on Events, its page, Home and in calendars", async ({ page, request }) => {
  await loginAsAdmin(page);
  const title = unique("E2E Halaqa");

  await page.goto("/admin/events/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Tag (e.g. Weekly, Youth, Community)").fill("Study");
  await page.getByLabel("Location (e.g. Main Prayer Hall)").fill("Library");
  await page.getByLabel("Description").fill("A weekly study circle for adults.");
  await page.getByLabel("Date", { exact: true }).fill(masjidDate(2));
  await page.getByLabel("Starts").fill("19:30");
  await page.getByLabel("Ends").fill("20:30");
  await page.getByLabel("Repeats").selectOption("weekly");
  await page.getByLabel(/^Photo/).setInputFiles("e2e/fixtures/event-photo.jpg");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("status")).toContainText("Event created");
  const slug = await page.getByLabel("Web address").inputValue();
  expect(slug).toMatch(/^e2e-halaqa-/);

  // Events page: listed as weekly, with calendar buttons.
  await page.goto("/events");
  const card = page.locator("article", { hasText: title });
  await expect(card).toContainText(/Every \w+day/);
  await expect(card).toContainText("7:30 PM – 8:30 PM");
  const ics = await request.get(await card.getByRole("link", { name: /\+ iCal/ }).getAttribute("href") as string);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  const body = await ics.text();
  expect(body).toContain(`SUMMARY:${title}`);
  expect(body).toMatch(/DTSTART;TZID=America\/Los_Angeles:\d{8}T193000/);
  expect(body).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=[A-Z]{2}/);
  const google = new URL((await card.getByRole("link", { name: /\+ Google/ }).getAttribute("href")) as string);
  expect(google.searchParams.get("action")).toBe("TEMPLATE");
  expect(google.searchParams.get("ctz")).toBe("America/Los_Angeles");

  // Detail page with the uploaded photo.
  await card.getByRole("link", { name: title, exact: true }).click();
  await expect(page).toHaveURL(`/events/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const photo = page.locator("img[src^='/media/events/']");
  await expect(photo).toBeVisible();
  expect((await request.get((await photo.getAttribute("src")) as string)).headers()["content-type"]).toBe("image/jpeg");

  // Home carousel (next 8 upcoming) includes it.
  await page.goto("/");
  await expect(page.locator("article[data-card]:not([aria-hidden])", { hasText: title })).toHaveCount(1);

  // Unpublish → gone from the site; then delete.
  await page.goto("/admin/events");
  await page.getByRole("link", { name: title, exact: true }).click();
  await page.getByLabel("Published (visible on the site)").uncheck();
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.goto("/events");
  await expect(page.locator("article", { hasText: title })).toHaveCount(0);
  expect((await request.get(`/events/${slug}`)).status()).toBe(404);

  await page.goto("/admin/events");
  await page.getByRole("link", { name: title, exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete event" }).click();
  await expect(page).toHaveURL(/status=deleted/);
});

test("a non-image upload is rejected", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/events/new");
  await page.getByLabel("Title").fill(unique("E2E bad photo"));
  await page.getByLabel("Tag (e.g. Weekly, Youth, Community)").fill("Test");
  await page.getByLabel("Location (e.g. Main Prayer Hall)").fill("Hall");
  await page.getByLabel("Description").fill("Should not be created.");
  await page.getByLabel(/^Photo/).setInputFiles("e2e/fixtures/not-an-image.jpg");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("status")).toHaveText("The photo must be a JPEG, PNG or WebP image.");
});
