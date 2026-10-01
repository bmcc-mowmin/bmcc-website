import { test, expect } from "@playwright/test";
import { roleState } from "./helpers";
import { waitForEmail } from "./mailpit";

// Contact form (About Us → #contact) → office inbox email + Admin → Messages.
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

test("a message from a service page: topic preselected, emails sent, handled in admin", async ({ browser }) => {
  const email = `e2e-contact-${uid()}@example.com`;
  const name = `E2E Contact ${uid()}`;
  const since = new Date();

  const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await visitor.newPage();
  await page.goto("/about?topic=nikah#contact"); // where "Schedule a Nikah" on Services links
  const form = page.getByRole("form", { name: "Send a Message" });
  await expect(form.getByLabel("What is this about?")).toHaveValue("nikah");

  await page.waitForTimeout(2600);
  await form.getByLabel("Your name").fill(name);
  await form.getByLabel("Email address").fill(email);
  // Server-side validation (the browser's own check is bypassed).
  await form.evaluate((f: HTMLFormElement) => (f.noValidate = true));
  await form.getByRole("button", { name: "Send Message" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Please check the highlighted fields." })).toBeVisible();
  await expect(page.getByLabel("How can we help?")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Your name")).toHaveValue(name); // kept

  await page.getByLabel("How can we help?").fill("We'd like to book a nikah in December.\nIs the hall free?");
  await page.getByRole("button", { name: "Send Message" }).click();
  await expect(page.getByRole("heading", { name: "Thank you — your message was sent" })).toBeVisible();
  await visitor.close();

  const ack = await waitForEmail(email, since);
  expect(ack.subject).toBe("We received your message");
  expect(ack.text).not.toContain("book a nikah"); // never echoes what was written

  const inbox = await waitForEmail("info@brmcc.org", since, 10_000, `[Website] Nikah Marriage Services — ${name}`);
  expect(inbox.replyTo).toEqual([email]);
  expect(inbox.text).toContain("Is the hall free?");

  // Membership coordinator handles it in Admin → Messages.
  const staff = await browser.newContext({ storageState: roleState("membership") });
  const admin = await staff.newPage();
  await admin.goto("/admin/messages");
  await admin.getByRole("link", { name }).click();
  await expect(admin.getByRole("heading", { name: `Message from ${name}` })).toBeVisible();
  await expect(admin.getByText("Is the hall free?")).toBeVisible();
  await expect(admin.getByRole("link", { name: "Reply by email" })).toHaveAttribute("href", new RegExp(`^mailto:${encodeURIComponent(email)}`));
  await admin.getByRole("button", { name: "Mark handled" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Marked handled." })).toBeVisible();
  await admin.goto("/admin/messages?status=HANDLED");
  await expect(admin.getByRole("link", { name })).toBeVisible();
  await admin.goto("/admin/messages");
  await expect(admin.getByRole("link", { name })).toHaveCount(0);

  await admin.goto("/admin/messages?status=HANDLED");
  await admin.getByRole("link", { name }).click();
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Delete" }).click();
  await expect(admin).toHaveURL(/\/admin\/messages\?deleted=1/);
  await staff.close();
});

test("treasurer can't open messages", async ({ browser }) => {
  const context = await browser.newContext({ storageState: roleState("treasurer") });
  const page = await context.newPage();
  await page.goto("/admin/messages");
  await expect(page).toHaveURL(/denied=1/);
  await context.close();
});
