import { test, expect, type Page } from "@playwright/test";
import { latestPayment } from "./db";
import { subjectsFor, waitForEmail } from "./mailpit";
import { roleState } from "./helpers";

// Donations and membership with the MOCK payment provider (PAYMENT_PROVIDER=mock).
const anon = { storageState: { cookies: [], origins: [] } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

async function payOnMockCheckout(page: Page, name: string, email: string) {
  await expect(page).toHaveURL(/\/checkout\//);
  await expect(page.getByRole("note")).toContainText("TEST MODE — no money moves");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel(/^Email/).fill(email);
  await page.getByRole("button", { name: /^Pay / }).click();
}

test.describe("donations", () => {
  test.use(anon);

  test("one-time donation: fund + preset amount → test checkout → thank-you with receipt; receipt emailed", async ({ page }) => {
    const email = `e2e-donor-${uid()}@example.com`;
    const since = new Date();
    await page.goto("/donate");
    await page.getByText("Help Us Build New BMCC").click();
    await page.getByRole("radio", { name: "One-time" }).click();
    await page.getByRole("radio", { name: "$100" }).click();
    await page.waitForTimeout(2600); // the spam check rejects instant submissions
    await page.getByRole("button", { name: "Donate $100 now to Help Us Build New BMCC →" }).click();
    await expect(page.getByRole("heading", { name: "Donation — Help Us Build New BMCC" })).toBeVisible();
    await payOnMockCheckout(page, "E2E Donor", email);

    await expect(page).toHaveURL(/\/donate\/thank-you\?checkout=/);
    await expect(page.getByRole("heading", { name: "JazakAllah Khair — thank you!" })).toBeVisible();
    await expect(page.getByText("Your gift of $100 to Help Us Build New BMCC was received.")).toBeVisible();
    const payment = await latestPayment(email);
    expect(payment).toMatchObject({ amountCents: 10000, fund: "new-bmcc", frequency: "ONE_TIME", kind: "DONATION" });
    await expect(page.getByText(payment.receiptNumber)).toBeVisible();

    const mail = await waitForEmail(email, since);
    expect(mail.subject).toBe(`Your BMCC receipt ${payment.receiptNumber}`);
    expect(mail.text).toContain("Donation — Help Us Build New BMCC: $100");
    expect(mail.text).toContain("No goods or services were provided in exchange for this contribution.");
  });

  test("monthly donation with a custom amount sets up a recurring gift", async ({ page }) => {
    const email = `e2e-monthly-${uid()}@example.com`;
    await page.goto("/donate");
    await page.getByRole("radio", { name: "Monthly" }).click();
    await page.getByLabel("Other amount").fill("2");
    await expect(page.getByText("Enter an amount of at least $5.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Donate \$2/ })).toBeDisabled();
    await page.getByLabel("Other amount").fill("37.5");
    await page.waitForTimeout(2600);
    await page.getByRole("button", { name: /^Donate \$37\.5 \/mo to Masjid Membership/ }).click();
    await expect(page.getByRole("button", { name: "Pay $37.50 / month (test)" })).toBeVisible();
    await payOnMockCheckout(page, "E2E Monthly", email);
    await expect(page.getByText("Your monthly gift of $37.50 to Masjid Membership is set up")).toBeVisible();
    expect(await latestPayment(email)).toMatchObject({ amountCents: 3750, frequency: "MONTHLY" });
  });

  test("a declined card takes no payment; cancel returns to Donate with a note", async ({ page }) => {
    const email = `e2e-cancel-${uid()}@example.com`;
    await page.goto("/donate");
    await page.waitForTimeout(2600);
    await page.getByRole("button", { name: /^Donate \$50/ }).click();
    await page.getByLabel("Name").fill("E2E Decline");
    await page.getByLabel(/^Email/).fill(email);
    await page.getByRole("button", { name: "Simulate a declined card" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Your card was declined (simulated)." })).toBeVisible();
    expect(await latestPayment(email)).toBeUndefined();

    await page.getByRole("button", { name: "← Cancel and go back" }).click();
    await expect(page).toHaveURL(/\/donate\?canceled=1/);
    await expect(page.getByText("Your donation wasn't completed and no payment was taken.")).toBeVisible();
  });
});

async function fillMembership(page: Page, name: string, email: string) {
  await page.goto("/membership");
  await page.getByLabel("Full Name").first().fill(name);
  await page.getByLabel("Street address").fill("1 Test Way");
  await page.getByLabel("City").fill("Brentwood");
  await page.getByLabel("State").fill("CA");
  await page.getByLabel("ZIP code").fill("94513");
  await page.getByLabel("Date of Birth").first().fill("1980-02-03");
  await page.getByLabel("Phone Number").first().fill("925-555-0150");
  await page.getByLabel("Email Address").first().fill(email);
}

test.describe("membership", () => {
  test.use(anon);

  test("application with a household member → dues checkout → active, benefit date, welcome + receipt emails", async ({ page }) => {
    const email = `e2e-member-${uid()}@example.com`;
    const since = new Date();

    // Missing fields → errors next to them, nothing created.
    await page.goto("/membership");
    await page.waitForTimeout(2600);
    await page.getByRole("button", { name: "Submit Membership Application" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Please check the highlighted fields." })).toBeVisible();
    await expect(page.getByLabel("Full Name").first()).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Please accept the declaration to continue.")).toBeVisible();

    await fillMembership(page, "E2E Member", email);
    await page.getByRole("button", { name: "+ Add Household Member" }).click();
    await page.locator('input[name="dep.1.name"]').fill("E2E Spouse");
    await page.locator('select[name="dep.1.relationship"]').selectOption("SPOUSE");
    await page.getByRole("button", { name: "+ Add Household Member" }).click();
    await page.getByRole("button", { name: "Remove this household member" }).nth(1).click(); // empty row removed
    await page.getByRole("radio", { name: /Yearly/ }).click();
    await page.locator('input[name="declaration"]').check();
    await page.waitForTimeout(2600);
    await page.getByRole("button", { name: "Submit Membership Application" }).click();

    await expect(page.getByRole("heading", { name: "BMCC membership dues (yearly)" })).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("E2E Member"); // prefilled from the application
    await page.getByRole("button", { name: /^Pay \$1,000 \/ year/ }).click();

    await expect(page.getByRole("heading", { name: "Welcome to BMCC — your membership is active" })).toBeVisible();
    await expect(page.getByText(/Your Funeral Services Benefit starts on \w+ \d+, \d{4}\./)).toBeVisible();
    const reference = (await page.locator("strong").filter({ hasText: /^BMCC-\d{4}-/ }).innerText()).trim();

    await waitForEmail(email, since);
    await expect.poll(() => subjectsFor(email)).toEqual(expect.arrayContaining([`Welcome to BMCC — membership ${reference}`, expect.stringMatching(/^Your BMCC receipt BMCC-/)]));
    expect(await latestPayment(email)).toMatchObject({ kind: "DUES", amountCents: 100000, frequency: "YEARLY" });
  });

  test("canceling the dues checkout keeps the application; Complete payment finishes it", async ({ page }) => {
    const email = `e2e-later-${uid()}@example.com`;
    await fillMembership(page, "E2E Later", email);
    await page.locator('input[name="declaration"]').check();
    await page.waitForTimeout(2600);
    await page.getByRole("button", { name: "Submit Membership Application" }).click();
    await page.getByRole("button", { name: "← Cancel and go back" }).click();
    await expect(page.getByRole("heading", { name: "Your application is saved — payment wasn't completed" })).toBeVisible();
    await page.getByRole("button", { name: "Complete payment →" }).click();
    await expect(page.getByRole("heading", { name: "BMCC membership dues (monthly)" })).toBeVisible();
    await page.getByRole("button", { name: /^Pay \$100 \/ month/ }).click();
    await expect(page.getByRole("heading", { name: "Welcome to BMCC — your membership is active" })).toBeVisible();
  });
});

test("admin: membership lifecycle — waiting period, missed payment (grace), paused, paid again", async ({ page }) => {
  const email = `e2e-life-${uid()}@example.com`;
  const visitor = await page.context().browser()!.newContext(anon);
  const v = await visitor.newPage();
  await fillMembership(v, "E2E Lifecycle", email);
  await v.locator('input[name="declaration"]').check();
  await v.waitForTimeout(2600);
  await v.getByRole("button", { name: "Submit Membership Application" }).click();
  await v.getByRole("button", { name: /^Pay / }).click();
  await expect(v.getByRole("heading", { name: "Welcome to BMCC — your membership is active" })).toBeVisible();
  await visitor.close();

  await page.goto(`/admin/memberships?q=${encodeURIComponent(email)}`);
  await page.getByRole("link", { name: "E2E Lifecycle" }).click();
  await expect(page.getByText("Waiting period (benefit not yet available)")).toBeVisible();
  await page.getByLabel("Membership ID (assigned by the office)").fill(`E2E-${uid()}`);
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).first()).toBeVisible();

  await page.getByRole("button", { name: "Next payment fails" }).click();
  await expect(page.getByText("Grace period ends", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Grace period ends now" }).click();
  await expect(page.getByText("Paused — dues overdue past the grace period")).toBeVisible();
  await page.getByRole("button", { name: "Next payment succeeds" }).click();
  // Paying resumes coverage — but never skips the 6-month waiting period of a new member.
  await expect(page.getByText("Waiting period (benefit not yet available)")).toBeVisible();
  await expect(page.locator("table").last().locator("tbody tr")).toHaveCount(2);
});

test("permissions: treasurer sees donations (no test tools) but not memberships; coordinator the reverse", async ({ browser }) => {
  const treasurer = await browser.newContext({ storageState: roleState("treasurer") });
  const t = await treasurer.newPage();
  await t.goto("/admin/donations");
  await expect(t.getByRole("heading", { name: "Donations", level: 1 })).toBeVisible();
  await expect(t.getByRole("button", { name: "Renew" })).toHaveCount(0);
  expect((await t.request.get("/admin/donations/export")).status()).toBe(200);
  await t.goto("/admin/memberships");
  await expect(t).toHaveURL(/denied=1/);
  await treasurer.close();

  const coordinator = await browser.newContext({ storageState: roleState("membership") });
  const c = await coordinator.newPage();
  await c.goto("/admin/memberships");
  await expect(c.getByRole("heading", { name: "Memberships", level: 1 })).toBeVisible();
  await c.goto("/admin/donations");
  await expect(c).toHaveURL(/denied=1/);
  expect((await c.request.get("/admin/donations/export")).status()).toBe(403);
  await coordinator.close();
});
