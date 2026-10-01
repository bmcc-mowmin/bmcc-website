import { test, expect, type Page } from "@playwright/test";
import { resetRateLimits, subscriberStatus } from "./db";
import { emailHeaders, firstLink, subjectsFor, waitForEmail } from "./mailpit";
import { roleState } from "./helpers";

// The new mailing list: re-subscribe bar + "Stay Connected", double opt-in, unsubscribe.
test.use({ storageState: { cookies: [], origins: [] } });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const bar = (page: Page) => page.getByRole("region", { name: /new mailing list/ });
const band = (page: Page) => page.getByRole("region", { name: "Stay Connected" });

// Every sign-up here comes from one address, and the site allows only a few per visitor.
test.beforeEach(() => resetRateLimits());

test("re-subscribe bar → confirmation email → confirm → welcome email with unsubscribe → unsubscribe", async ({ page }) => {
  const email = `e2e-sub-${uid()}@example.com`;
  const since = new Date();
  await page.goto("/");
  await page.waitForTimeout(2600); // the spam check rejects instant submissions
  await bar(page).getByLabel("Your email address").fill(email);
  await bar(page).getByRole("button", { name: "Subscribe Now" }).click();
  await expect(bar(page).getByRole("status")).toHaveText(/Thanks — check your inbox to confirm your subscription\./);
  expect(await subscriberStatus(email)).toMatchObject({ status: "PENDING", source: "resub_bar", lang: "en" });

  const mail = await waitForEmail(email, since);
  expect(mail.subject).toBe("Please confirm your BMCC email subscription");
  const link = firstLink(mail.text, "/subscribe/confirm?token=");

  // Opening the link alone changes nothing (mail scanners open links); the button confirms.
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Confirm your subscription" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  expect((await subscriberStatus(email)).status).toBe("PENDING");
  const confirmedAt = new Date();
  await page.getByRole("button", { name: "Confirm my subscription" }).click();
  await expect(page.getByRole("heading", { name: "You're subscribed — JazakAllah Khair!" })).toBeVisible();
  expect((await subscriberStatus(email)).status).toBe("CONFIRMED");

  // The link works once.
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "This link has expired or was already used" })).toBeVisible();

  const welcome = await waitForEmail(email, confirmedAt, 10_000, "You're subscribed to BMCC emails");
  const headers = await emailHeaders(welcome.id);
  expect(headers["List-Unsubscribe-Post"]).toEqual(["List-Unsubscribe=One-Click"]);
  expect(headers["List-Unsubscribe"][0]).toMatch(/\/api\/unsubscribe\?token=/);

  await page.goto(firstLink(welcome.text, "/unsubscribe?token="));
  await expect(page.getByText(`Stop sending mailing-list emails to ${email}?`)).toBeVisible();
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("heading", { name: "You're unsubscribed" })).toBeVisible();
  expect((await subscriberStatus(email)).status).toBe("UNSUBSCRIBED");
});

test("Stay Connected uses the same list; an address already on the list gets no second email", async ({ page }) => {
  const email = `e2e-band-${uid()}@example.com`;
  await page.goto("/");
  await page.waitForTimeout(2600);
  await band(page).getByLabel("you@example.com").fill(email);
  await band(page).getByRole("button", { name: "Subscribe" }).click();
  await expect(band(page).getByRole("status")).toHaveText(/check your inbox to confirm/);
  expect(await subscriberStatus(email)).toMatchObject({ status: "PENDING", source: "newsletter" });
  const mail = await waitForEmail(email, new Date(Date.now() - 5000));
  await page.goto(firstLink(mail.text, "/subscribe/confirm?token="));
  await page.getByRole("button", { name: "Confirm my subscription" }).click();
  await expect(page.getByRole("heading", { name: "You're subscribed — JazakAllah Khair!" })).toBeVisible();

  // Signing up again shows the same message (no hint who is subscribed) and sends nothing.
  await page.goto("/");
  await page.waitForTimeout(2600);
  await bar(page).getByLabel("Your email address").fill(email);
  await bar(page).getByRole("button", { name: "Subscribe Now" }).click();
  await expect(bar(page).getByRole("status")).toBeVisible();
  await page.waitForTimeout(1500);
  expect((await subjectsFor(email)).filter((s) => s === "Please confirm your BMCC email subscription")).toHaveLength(1);
});

test("a too-quick press asks to press again; a bad address is refused", async ({ page }) => {
  const email = `e2e-quick-${uid()}@example.com`;
  await page.goto("/");
  await bar(page).getByLabel("Your email address").fill(email);
  await bar(page).getByRole("button", { name: "Subscribe Now" }).click();
  await expect(bar(page).getByRole("alert")).toHaveText("That was a little too quick — please press the button again.");
  await expect(bar(page).getByLabel("Your email address")).toHaveValue(email);
  await page.waitForTimeout(2600); // the minimum time counts from when the page was shown
  await bar(page).getByRole("button", { name: "Subscribe Now" }).click();
  await expect(bar(page).getByRole("status")).toBeVisible();

  // Server-side check (bypassing the browser's own email validation).
  await page.goto("/");
  await page.waitForTimeout(2600);
  const input = bar(page).getByLabel("Your email address");
  await bar(page).locator("form").evaluate((f: HTMLFormElement) => (f.noValidate = true));
  await input.fill("not-an-email");
  await bar(page).getByRole("button", { name: "Subscribe Now" }).click();
  await expect(bar(page).getByRole("alert")).toHaveText("Enter a valid email address.");
  await expect(input).toHaveAttribute("aria-invalid", "true");
});

test("dismissing the bar lasts for the browser session", async ({ page, browser }) => {
  await page.goto("/");
  await bar(page).getByRole("button", { name: "Close" }).click();
  await expect(bar(page)).toHaveCount(0);
  await page.reload();
  await expect(bar(page)).toBeHidden();
  await page.goto("/events");
  await page.goto("/");
  await expect(bar(page)).toBeHidden();

  // A new session (new browser context) shows it again.
  const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const p = await other.newPage();
  await p.goto("/");
  await expect(bar(p)).toBeVisible();
  await other.close();
});

test("admin: editor sees subscribers and exports the confirmed list; treasurer can't", async ({ browser }) => {
  const email = `e2e-admin-${uid()}@example.com`;
  const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const v = await visitor.newPage();
  await v.goto("/");
  await v.waitForTimeout(2600);
  await bar(v).getByLabel("Your email address").fill(email);
  await bar(v).getByRole("button", { name: "Subscribe Now" }).click();
  await expect(bar(v).getByRole("status")).toBeVisible();
  const mail = await waitForEmail(email, new Date(Date.now() - 5000));
  await v.goto(firstLink(mail.text, "/subscribe/confirm?token="));
  await v.getByRole("button", { name: "Confirm my subscription" }).click();
  await expect(v.getByRole("heading", { name: "You're subscribed — JazakAllah Khair!" })).toBeVisible();
  await visitor.close();

  const editor = await browser.newContext({ storageState: roleState("editor") });
  const page = await editor.newPage();
  await page.goto(`/admin/subscribers?q=${encodeURIComponent(email)}`);
  await expect(page.getByRole("heading", { name: "Mailing list", level: 1 })).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(email) });
  await expect(row).toContainText("Re-subscribe bar");
  const csv = await (await page.request.get("/admin/subscribers/export")).text();
  expect(csv).toContain(email);
  expect(csv.split(/\r?\n/)[0]).toBe("email,language,source,confirmed at,unsubscribe url");

  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(row).toHaveCount(0); // moved to the Unsubscribed tab
  await page.getByRole("link", { name: /^Unsubscribed \(/ }).click();
  await expect(page.getByRole("row", { name: new RegExp(email) })).toBeVisible();
  expect((await subscriberStatus(email)).status).toBe("UNSUBSCRIBED");
  expect(await (await page.request.get("/admin/subscribers/export")).text()).not.toContain(email);
  await editor.close();

  const treasurer = await browser.newContext({ storageState: roleState("treasurer") });
  const t = await treasurer.newPage();
  await t.goto("/admin/subscribers");
  await expect(t).toHaveURL(/denied=1/);
  expect((await t.request.get("/admin/subscribers/export")).status()).toBe(403);
  await treasurer.close();
});
