import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin, masjidDate, unique } from "./helpers";

const ticker = (page: Page) => page.getByRole("region", { name: "Updates" });

test("announcements show only inside their start/end window and while active", async ({ page }) => {
  await loginAsAdmin(page);
  const text = unique("E2E notice");
  const add = page.locator("section", { has: page.getByRole("heading", { name: "Add an announcement" }) });

  // Scheduled for tomorrow → not in the ticker yet.
  await page.goto("/admin/announcements");
  await add.getByLabel("Text").fill(text);
  await add.getByLabel("Link (optional)").fill("/events");
  await add.getByLabel("Show from").fill(`${masjidDate(1)}T00:00`);
  await add.getByRole("button", { name: "Add announcement" }).click();
  await expect(add.getByRole("status")).toHaveText("Announcement added.");
  await page.goto("/");
  await expect(ticker(page)).not.toContainText(text);

  // Start it now → it appears, linked.
  await page.goto("/admin/announcements");
  const card = page.locator("section", { has: page.locator(`input[value="${text}"]`) });
  await expect(card).toContainText("Scheduled");
  await card.getByLabel("Show from").fill(`${masjidDate(-1)}T00:00`);
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("status")).toHaveText("Saved.");
  await page.goto("/");
  await expect(ticker(page).getByRole("link", { name: text }).first()).toHaveAttribute("href", "/events");

  // Inactive → hidden again.
  await page.goto("/admin/announcements");
  await card.getByLabel("Active").uncheck();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("status")).toHaveText("Saved.");
  await page.goto("/");
  await expect(ticker(page)).not.toContainText(text);

  // Clean up.
  await page.goto("/admin/announcements");
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Delete" }).click();
  await expect(card).toHaveCount(0);
});

test("the seeded expired announcement never appears", async ({ page }) => {
  await page.goto("/");
  await expect(ticker(page)).not.toContainText("Expired sample announcement");
});
