import { test, expect, type Page, type Browser } from "@playwright/test";
import { resetRateLimits, sql } from "./db";
import { firstLink, subjectsFor, waitForEmail } from "./mailpit";
import { roleState } from "./helpers";

// Member sign-in and the member portal (My account), RSVPs. The seeded member signs in with a
// password; anyone else BMCC knows by email (donor, member) uses an emailed sign-in link.
const anon = { storageState: { cookies: [], origins: [] } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const MEMBER = process.env.SEED_MEMBER_EMAIL ?? "member@bmcc.local";

test.beforeEach(() => resetRateLimits());

async function donateMonthly(page: Page, email: string, amount: string) {
  await page.goto("/donate");
  await page.getByRole("radio", { name: "Monthly" }).click();
  await page.getByLabel("Other amount").fill(amount);
  await page.waitForTimeout(2600);
  await page.getByRole("button", { name: new RegExp(`^Donate \\$${amount} /mo`) }).click();
  await page.getByLabel("Name").fill("E2E Donor Portal");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(page).toHaveURL(/\/donate\/thank-you/);
}

async function signInWithLink(browser: Browser, email: string) {
  const context = await browser.newContext(anon);
  const page = await context.newPage();
  const since = new Date();
  await page.goto("/login");
  await page.waitForTimeout(2600);
  const form = page.getByRole("form", { name: "No password? Get a sign-in link" });
  await form.getByLabel("Email address").fill(email);
  await form.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText(`We've sent a sign-in link to ${email}.`);
  const mail = await waitForEmail(email, since);
  expect(mail.subject).toBe("Your BMCC sign-in link");
  const link = firstLink(mail.text, "/login/link?token=");
  await page.goto(link);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  return { context, page, link };
}

test("seeded member: password sign-in → membership, household, receipts; sign out", async ({ browser }) => {
  const context = await browser.newContext(anon);
  const page = await context.newPage();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  const form = page.getByRole("form", { name: "Member Login" });
  await form.getByLabel("Email address").fill(MEMBER);
  await form.getByLabel("Password").fill("wrong password");
  await form.getByRole("button", { name: "Log In" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The email or password is incorrect." })).toBeVisible();
  await form.getByLabel("Password").fill(process.env.SEED_MEMBER_PASSWORD!);
  await form.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL(/\/account$/);

  const card = page.getByRole("region", { name: "BMCC membership" });
  await expect(card).toContainText("M-0001");
  await expect(card).toContainText("BMCC-TEST01");
  await expect(card.getByText(/^Active — /)).toBeVisible();
  await expect(page.getByRole("link", { name: "My account" }).first()).toBeVisible(); // header

  await page.getByRole("link", { name: "Household", exact: true }).click();
  await expect(page.getByRole("region", { name: "People covered by the Funeral Services Benefit" }).getByRole("listitem")).toHaveCount(3);

  await page.getByRole("link", { name: "Giving & receipts" }).click();
  const history = page.getByRole("region", { name: "Payment history" });
  await expect(history.getByRole("row")).not.toHaveCount(1);
  await history.getByRole("link", { name: /^BMCC-\d{4}-/ }).first().click();
  await expect(page.getByRole("heading", { name: /receipt$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});

test("donor: emailed sign-in link → giving history, stop a monthly gift; link works once; unknown email is told to join", async ({ browser }) => {
  const email = `e2e-portal-${uid()}@example.com`;
  const visitor = await browser.newContext(anon);
  await donateMonthly(await visitor.newPage(), email, "15");
  await visitor.close();

  const { context, page, link } = await signInWithLink(browser, email);
  await expect(page.getByRole("heading", { name: "You're not a member yet" })).toBeVisible();
  await page.getByRole("link", { name: "Giving & receipts" }).click();
  const gifts = page.getByRole("region", { name: "Monthly gifts" });
  await expect(gifts).toContainText("$15 every month to Masjid Membership");
  page.once("dialog", (d) => d.accept());
  await gifts.getByRole("button", { name: "Stop this monthly gift" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your monthly gift was stopped." })).toBeVisible();
  await expect(gifts).toContainText("You don't have a monthly gift.");
  expect((await sql<{ status: string }>(`SELECT status FROM "Subscription" WHERE email = $1`, [email]))[0].status).toBe("CANCELED");
  await expect(page.getByRole("region", { name: "Payment history" })).toContainText("$15");
  await context.close();

  // The emailed link is single use.
  const again = await browser.newContext(anon);
  const ap = await again.newPage();
  await ap.goto(link);
  await expect(ap.getByRole("heading", { name: "This sign-in link has expired or was already used" })).toBeVisible();

  // An address BMCC doesn't know is told so, with a link to become a member; nothing is sent.
  const unknown = `e2e-nobody-${uid()}@example.com`;
  await ap.goto("/login");
  await ap.waitForTimeout(2600);
  const form = ap.getByRole("form", { name: "No password? Get a sign-in link" });
  await form.getByLabel("Email address").fill(unknown);
  await form.getByRole("button", { name: "Email me a sign-in link" }).click();
  const notFound = form.getByRole("alert");
  await expect(notFound).toContainText(`We couldn't find ${unknown} in BMCC's member or donor records.`);
  await expect(form.getByLabel("Email address")).toHaveValue(unknown); // kept, to fix a typo
  await expect(notFound.getByRole("link", { name: "Become a Member →" })).toHaveAttribute("href", "/membership");
  expect(await sql(`SELECT 1 FROM "User" WHERE email = $1`, [unknown])).toHaveLength(0);

  // A staff account is pointed to the password form, and gets no link.
  await form.getByLabel("Email address").fill("editor@bmcc.local");
  await ap.waitForTimeout(2600);
  await form.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(form.getByRole("alert")).toHaveText("This is a staff account. Please sign in with your password above.");
  await ap.waitForTimeout(1000);
  expect((await subjectsFor("editor@bmcc.local")).filter((s) => s === "Your BMCC sign-in link")).toHaveLength(0);
  await again.close();
});

test("household: update contact details; request a change to covered people (emailed to the office)", async ({ browser }) => {
  const context = await browser.newContext({ storageState: roleState("member") });
  const page = await context.newPage();
  await page.goto("/account/household");
  const contact = page.getByRole("region", { name: "Contact details" });
  const original = await contact.getByLabel("Phone Number").inputValue();

  await contact.getByLabel("City").fill("");
  await contact.getByRole("button", { name: "Save changes" }).click();
  await expect(contact.getByRole("alert")).toHaveText("Please check the highlighted fields.");
  await expect(contact.getByLabel("City")).toHaveAttribute("aria-invalid", "true");
  await contact.getByLabel("City").fill("Brentwood");
  await contact.getByLabel("Phone Number").fill("925-555-0199");
  await contact.getByRole("button", { name: "Save changes" }).click();
  await expect(contact.getByRole("status")).toHaveText("Saved.");
  await page.reload();
  await expect(contact.getByLabel("Phone Number")).toHaveValue("925-555-0199");
  await contact.getByLabel("Phone Number").fill(original);
  await contact.getByRole("button", { name: "Save changes" }).click();
  await expect(contact.getByRole("status")).toHaveText("Saved.");

  const since = new Date();
  const covered = page.getByRole("region", { name: "People covered by the Funeral Services Benefit" });
  await covered.getByLabel("Add or remove someone").fill("E2E request: please add our son Yusuf, born 2025-03-14.");
  await covered.getByRole("button", { name: "Send request" }).click();
  await expect(covered.getByRole("status")).toContainText("Your request was sent to the BMCC office.");
  const mail = await waitForEmail("info@brmcc.org", since, 10_000, "[Member] Change to covered people — BMCC-TEST01");
  expect(mail.replyTo).toEqual([MEMBER]);
  expect(mail.text).toContain("please add our son Yusuf");
  await sql(`DELETE FROM "ContactMessage" WHERE message LIKE 'E2E request:%'`);
  await context.close();
});

test("RSVP: member signs up for the community dinner; limit is enforced; admin sees it; cancel", async ({ browser, page: adminPage }) => {
  // Anonymous visitors are asked to sign in.
  const anonContext = await browser.newContext(anon);
  const ap = await anonContext.newPage();
  await ap.goto("/events/community-dinner");
  await expect(ap.getByRole("link", { name: "Sign in to RSVP" })).toHaveAttribute("href", /\/login\?next=/);
  await anonContext.close();

  await sql(`UPDATE "Event" SET "rsvpCapacity" = 3 WHERE slug = 'community-dinner'`);
  const member = await browser.newContext({ storageState: roleState("member") });
  const page = await member.newPage();
  await page.goto("/events/community-dinner");
  await expect(page.getByText("3 places left")).toBeVisible();
  await page.getByLabel("How many people (including you)?").selectOption("2");
  await page.getByRole("button", { name: "RSVP", exact: true }).click();
  await expect(page.getByText("You're on the list — see you there!")).toBeVisible();
  await expect(page.getByText(/^You're going: 2 people · /)).toBeVisible();

  // Someone else can't take more than the 1 place left.
  const donor = `e2e-rsvp-${uid()}@example.com`;
  const visitor = await browser.newContext(anon);
  await donateMonthly(await visitor.newPage(), donor, "6");
  await visitor.close();
  const other = await signInWithLink(browser, donor);
  await other.page.goto("/events/community-dinner");
  await expect(other.page.getByText("1 places left")).toBeVisible();
  await other.page.getByLabel("How many people (including you)?").selectOption("2");
  await other.page.getByRole("button", { name: "RSVP", exact: true }).click();
  await expect(other.page.getByRole("alert").filter({ hasText: "full" })).toHaveText("Sorry — this date is full.");
  await other.context.close();

  // Admin sees who's coming.
  await adminPage.goto("/admin/events");
  await adminPage.getByRole("link", { name: /Dinner/ }).first().click();
  const rsvps = adminPage.getByRole("region", { name: "RSVPs" });
  await expect(rsvps).toContainText("2 people of 3");
  await expect(rsvps).toContainText(MEMBER);

  // My RSVPs lists it; cancel there.
  await page.goto("/account/events");
  const list = page.getByRole("region", { name: "Upcoming events you're going to" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("2 people");
  await list.getByRole("button", { name: "Cancel RSVP" }).click();
  await expect(list).toContainText("You haven't RSVP'd to any upcoming events.");
  await member.close();
  await sql(`UPDATE "Event" SET "rsvpCapacity" = 60 WHERE slug = 'community-dinner'`);
});
