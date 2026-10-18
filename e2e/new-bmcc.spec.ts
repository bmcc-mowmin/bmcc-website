import { test, expect, type Browser } from "@playwright/test";
import { roleState } from "./helpers";
import { sql } from "./db";

// The New BMCC project page, its figures and updates, and the photo collections that keep land
// photos on the project page and archived photos off the site.
const uid = () => Date.now().toString(36);
const anon = { storageState: { cookies: [], origins: [] } };
async function as(browser: Browser, role: string) {
  const context = await browser.newContext({ storageState: roleState(role) });
  return { context, page: await context.newPage() };
}

test("the project page is reachable from the menu and Donate, and its give buttons pick the fund", async ({ browser }) => {
  const context = await browser.newContext(anon);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Donations & Memberships" }).click();
  await page.getByRole("link", { name: /The new BMCC/ }).first().click();
  await expect(page).toHaveURL(/\/new-bmcc$/);
  await expect(page.getByRole("heading", { level: 1, name: "Building the new BMCC" })).toBeVisible();
  await expect(page.getByLabel("The project at a glance")).toContainText("8.16 acres");

  await page.getByRole("link", { name: "Give monthly" }).first().click();
  await expect(page).toHaveURL(/fund=new-bmcc&frequency=monthly/);
  await expect(page.getByRole("radio", { name: "Monthly" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("link", { name: /About the new BMCC project/ }).click();
  await expect(page).toHaveURL(/\/new-bmcc$/);
  await context.close();
});

test("figures: the treasurer sets a goal and offline amount; the page shows progress including online gifts", async ({ browser }) => {
  const [before] = await sql<Record<string, unknown>>(`SELECT * FROM "CampaignSettings" WHERE id = 1`);
  const online = Number((await sql<{ c: string }>(`SELECT COALESCE(SUM("amountCents"),0) AS c FROM "Payment" WHERE kind='DONATION' AND fund='new-bmcc' AND status='SUCCEEDED'`))[0].c);
  const { context, page } = await as(browser, "treasurer");
  await page.goto("/admin/new-bmcc");
  await page.getByLabel("Goal ($)").fill("1,000,000");
  await page.getByLabel("Raised other ways ($)").fill("250,000");
  await page.getByLabel("Show the progress bar on the project page").check();
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByRole("status").first()).toHaveText("Saved. The project page is updated.");

  const visitor = await browser.newContext(anon);
  const v = await visitor.newPage();
  await v.goto("/new-bmcc");
  const raised = (250_000_00 + online) / 100;
  await expect(v.getByText(`toward our goal of $1,000,000`)).toContainText(`$${raised.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
  await expect(v.getByRole("progressbar", { name: "Progress" })).toHaveAttribute("aria-valuenow", String(Math.round((raised / 1_000_000) * 100)));
  await visitor.close();
  await context.close();

  // Put the figures back as they were.
  if (before) await sql(`UPDATE "CampaignSettings" SET "goalCents"=$1, "offlineRaisedCents"=$2, "raisedAsOf"=$3, "showProgress"=$4 WHERE id=1`, [before.goalCents, before.offlineRaisedCents, before.raisedAsOf, before.showProgress]);
  else await sql(`DELETE FROM "CampaignSettings" WHERE id = 1`);
});

test("updates: a content editor posts an update; drafts stay hidden", async ({ browser }) => {
  const title = `E2E site survey ${uid()}`;
  const { context, page } = await as(browser, "editor");
  await page.goto("/admin/new-bmcc");
  const add = page.getByRole("region", { name: "Post an update" });
  await add.getByLabel("Title").fill(title);
  await add.getByLabel("Text").fill("E2E: the land survey is complete.");
  await add.getByRole("button", { name: "Add update" }).click();
  await expect(add.getByRole("status")).toHaveText("Update added.");

  const visitor = await browser.newContext(anon);
  const v = await visitor.newPage();
  await v.goto("/new-bmcc");
  const updates = v.getByRole("region", { name: "Project updates" });
  await expect(updates).toContainText(title);

  await page.reload();
  const item = page.getByRole("article", { name: title });
  await item.getByText("Edit").click();
  await item.getByLabel("Published").uncheck();
  await item.getByRole("button", { name: "Save update" }).click();
  await expect(item.getByRole("status")).toHaveText("Saved.");
  await v.reload();
  await expect(updates).not.toContainText(title);
  await visitor.close();
  await context.close();
});

test("collections: a land photo shows only on the project page; archiving takes a photo off the site", async ({ browser }) => {
  const alt = `E2E land corner ${uid()}`;
  const { context, page } = await as(browser, "editor");
  await page.goto("/admin/media");
  const upload = page.getByRole("region", { name: "Upload a photo" });
  await upload.getByLabel("Photo", { exact: true }).setInputFiles("e2e/fixtures/event-photo.jpg");
  await upload.getByLabel(/Describe the photo/).fill(alt);
  await upload.getByLabel(/New BMCC project/).check();
  await upload.getByRole("button", { name: "Upload" }).click();
  await expect(upload.getByRole("status")).toContainText("Uploaded");

  // Not offered for general places such as the Home photo.
  await page.reload();
  const home = page.getByRole("group", { name: "Home — wide photo under the opening" });
  await expect(home.locator("option", { hasText: alt })).toHaveCount(0);

  const visitor = await browser.newContext(anon);
  const v = await visitor.newPage();
  await v.goto("/new-bmcc");
  await expect(v.getByRole("region", { name: "The land" }).getByRole("img", { name: alt })).toBeVisible();
  for (const path of ["/", "/about"]) {
    await v.goto(path);
    await expect(v.getByRole("img", { name: alt })).toHaveCount(0);
  }

  // Archive it: it leaves the project page too.
  const card = page.getByRole("article").filter({ has: page.getByRole("img", { name: alt }) });
  await card.getByLabel(/^Collection for/).selectOption("archive");
  await card.getByRole("button", { name: "Move" }).click();
  await expect(card.getByRole("status")).toContainText("Moved");
  await v.goto("/new-bmcc");
  await expect(v.getByRole("img", { name: alt })).toHaveCount(0);
  await visitor.close();
  await context.close();
});
