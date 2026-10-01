import { test, expect } from "@playwright/test";
import { roleState } from "./helpers";
import { firstLink, waitForEmail } from "./mailpit";

const sidebar = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Admin" });

test.describe("roles", () => {
  test("content editor sees Events and Announcements only, and is turned away from other sections", async ({ browser }) => {
    const context = await browser.newContext({ storageState: roleState("editor") });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(sidebar(page).getByRole("link", { name: "Events" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Announcements" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Prayer times" })).toHaveCount(0);
    await expect(sidebar(page).getByRole("link", { name: "Admin users" })).toHaveCount(0);

    for (const path of ["/admin/prayer-times", "/admin/users", "/admin/activity"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\?denied=1$/);
      await expect(page.getByText("You don't have access to that section.")).toBeVisible();
    }
    await context.close();
  });

  test("prayer manager can manage prayer times but not events", async ({ browser }) => {
    const context = await browser.newContext({ storageState: roleState("prayer") });
    const page = await context.newPage();
    await page.goto("/admin/prayer-times");
    await expect(page.getByRole("heading", { name: "Prayer times", level: 1 })).toBeVisible();
    await page.goto("/admin/events");
    await expect(page).toHaveURL(/denied=1/);
    await context.close();
  });

  test("treasurer gets the dashboard and Donations only", async ({ browser }) => {
    const context = await browser.newContext({ storageState: roleState("treasurer") });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(page.getByText("Donations this month")).toBeVisible();
    await expect(page.getByText("Upcoming events")).toHaveCount(0);
    await expect(sidebar(page).getByRole("link")).toHaveText(["Dashboard", "Donations"]);
    await context.close();
  });
});

test("super admin invites an admin; the invite email sets a password; disabling signs them out", async ({ page, browser }) => {
  const email = `e2e-${Date.now().toString(36)}@example.com`;
  const since = new Date();

  await page.goto("/admin/users");
  const invite = page.locator("section", { has: page.getByRole("heading", { name: "Invite an admin" }) });
  await invite.getByLabel("Name").fill("E2E Invitee");
  await invite.getByLabel("Email").fill(email);
  await invite.getByLabel(/Content editor/).check();
  await invite.getByRole("button", { name: "Send invite" }).click();
  await expect(invite.getByRole("status")).toContainText(`Invite sent to ${email}`);
  const card = page.getByRole("region", { name: email });
  await expect(card).toContainText("Invite pending");

  const mail = await waitForEmail(email, since);
  expect(mail.subject).toBe("You're invited to the BMCC admin portal");
  const link = firstLink(mail.text, "/admin/set-password?token=");

  // The invitee sets a password and lands in the portal with the Content editor sections.
  const invitee = await browser.newContext();
  const ip = await invitee.newPage();
  await ip.goto(link);
  await ip.getByLabel("New password").fill("a long test passphrase");
  await ip.getByLabel("Confirm password").fill("a long test passphrase");
  await ip.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(ip).toHaveURL(/\/admin\?welcome=1$/);
  await expect(sidebar(ip).getByRole("link", { name: "Events" })).toBeVisible();

  // The link works only once.
  const again = await browser.newContext();
  const ap = await again.newPage();
  await ap.goto(link);
  await expect(ap.getByText("This link has expired or was already used.")).toBeVisible();
  await again.close();

  // Super admin disables them → their next request is signed out; signing in is refused.
  await page.reload();
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Disable" }).click();
  await expect(card.getByRole("status")).toContainText("Disabled");
  await ip.goto("/admin/events");
  await expect(ip).toHaveURL(/\/admin\/login/);
  await ip.getByLabel("Email address").fill(email);
  await ip.getByLabel("Password").fill("a long test passphrase");
  await ip.getByRole("button", { name: "Sign in" }).click();
  await expect(ip.getByRole("alert").filter({ hasText: "The email or password is incorrect." })).toBeVisible();
  await invitee.close();

  // Everything above is in the activity log.
  await page.goto("/admin/activity?entity=User");
  await expect(page.locator("tbody")).toContainText("invite");
  await expect(page.locator("tbody")).toContainText("disable");

  // Clean up: remove their admin access.
  await page.goto("/admin/users");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("region", { name: email }).getByRole("button", { name: "Remove admin access" }).click();
  await expect(page.getByRole("region", { name: email })).toHaveCount(0);
});

test("the last active super admin can't be removed or demoted", async ({ page }) => {
  await page.goto("/admin/users");
  const me = page.getByRole("region", { name: process.env.SEED_ADMIN_EMAIL });
  await me.getByLabel(/Content editor/).check();
  await me.getByLabel(/Super admin/).uncheck();
  await me.getByRole("button", { name: "Save roles" }).click();
  await expect(me.getByRole("status")).toHaveText("You can't remove your own Super admin role.");
  await expect(me.getByRole("button", { name: "Disable" })).toHaveCount(0);
});
