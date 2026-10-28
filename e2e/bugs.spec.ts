import { rm } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Browser } from "@playwright/test";
import { roleState } from "./helpers";
import { resetRateLimits, sql } from "./db";
import { waitForEmail } from "./mailpit";

// Bug reports: the public "Report a problem" form (with attachments) → triage by a super admin →
// the owner works on it → the reporter hears back. Attachments stay private to admins.
const anon = { storageState: { cookies: [], origins: [] } };
const uid = () => Date.now().toString(36);
// Leave the tracker as it was: remove the test reports and their files, and let numbering carry on
// from the last real report (so test runs don't use up BUG numbers).
test.afterAll(async () => {
  const files = await sql<{ storageKey: string }>(`SELECT a."storageKey" FROM "BugAttachment" a JOIN "BugReport" b ON b.id = a."bugId" WHERE b.title LIKE 'E2E%'`);
  await sql(`DELETE FROM "BugReport" WHERE title LIKE 'E2E%'`);
  await sql(`SELECT setval('"BugReport_number_seq"', COALESCE((SELECT MAX(number) FROM "BugReport"), 0) + 1, false)`);
  const dir = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
  await Promise.all(files.map((f) => rm(path.join(dir, f.storageKey), { force: true })));
});

async function as(browser: Browser, role: string) {
  const context = await browser.newContext({ storageState: roleState(role) });
  return { context, page: await context.newPage() };
}

test("report → triage → owner fixes it → reporter is told; files stay private", async ({ browser, page: admin }) => {
  test.setTimeout(120_000);
  await resetRateLimits();
  const title = `E2E Prayer table cut off ${uid()}`;
  const reporter = `e2e-bug-${uid()}@example.com`;
  const since = new Date();

  // 1. A visitor reports a problem from the footer link of the page they're on.
  const visitor = await browser.newContext(anon);
  const v = await visitor.newPage();
  await v.goto("/prayer-times");
  await v.getByRole("contentinfo").getByRole("link", { name: "Report a problem" }).click();
  await expect(v).toHaveURL(/\/report-a-problem\?from=%2Fprayer-times/);
  await expect(v.getByLabel("Which page?")).toHaveValue("/prayer-times");
  await v.waitForTimeout(2600); // the form's spam timer
  await v.getByLabel("What went wrong?").fill(title);
  await v.getByLabel("Type of problem").selectOption("display");
  await v.getByLabel("What happened?").fill("E2E: the Iqamah column is cut off on my phone.");
  await v.getByLabel("How can we see it happen?").fill("Open Prayer Times on a small phone.");
  await v.getByRole("radio", { name: "I couldn't do what I came to do" }).check();
  await v.getByLabel("Screenshots or files").setInputFiles("e2e/fixtures/event-photo.jpg");
  await v.getByLabel("Your email").fill(reporter);
  await v.getByRole("button", { name: "Send report" }).click();
  const done = v.getByRole("status");
  await expect(done).toContainText("Thank you");
  const ref = (await done.locator("span").first().textContent())!.trim();
  expect(ref).toMatch(/^BUG-\d{4,}$/);
  const number = Number(ref.slice(4));
  const ack = await waitForEmail(reporter, since);
  expect(ack.subject).toContain(ref);
  await waitForEmail("admin@bmcc.local", since, 10_000, `[Bug ${ref}] New report — ${title}`);
  // The bug reports inbox (it_support@brmcc.org by default) gets the report and a copy of what the reporter was told.
  await waitForEmail("it_support@brmcc.org", since, 10_000, `[Bug ${ref}] New report — ${title}`);
  const copy = await waitForEmail("it_support@brmcc.org", since, 10_000, `[Copy · ${ref}] ${ack.subject}`);
  expect(copy.text).toContain(reporter);

  // 2. Its files are private.
  const [file] = await sql<{ id: string }>(`SELECT a.id FROM "BugAttachment" a JOIN "BugReport" b ON b.id = a."bugId" WHERE b.number = $1`, [number]);
  // Signed out, the admin area sends you to its sign-in page instead of the file.
  const peek = await v.request.get(`/admin/bugs/files/${file.id}`);
  expect(peek.headers()["content-type"]).not.toContain("image/");
  expect(peek.url()).toContain("/admin/login");
  await visitor.close();

  // 3. A super admin triages it: the area was guessed from the page; priority + owner → Triaged.
  await admin.goto("/admin/bugs");
  await admin.getByRole("link", { name: new RegExp(title) }).click();
  await expect(admin.getByRole("heading", { level: 1 })).toContainText(ref);
  const real = await admin.request.get(`/admin/bugs/files/${file.id}`);
  expect(real.status()).toBe(200);
  expect(real.headers()["content-type"]).toBe("image/jpeg");
  const triage = admin.getByRole("region", { name: "Triage" });
  await expect(triage.getByLabel("Area")).toHaveValue("prayer");
  await expect(triage).toContainText("From the reporter’s answers: P2 · High");
  await triage.getByLabel("Priority").selectOption("P2");
  await triage.getByLabel("Owner").selectOption({ label: "Content Editor (test)" });
  await triage.getByRole("button", { name: "Save triage" }).click();
  await expect(triage.getByRole("status")).toHaveText("Saved.");
  await admin.reload();
  await expect(admin.getByText("Triaged", { exact: true }).first()).toBeVisible();
  await expect(admin.getByText(/^Due /)).toBeVisible();
  await waitForEmail("editor@bmcc.local", since, 10_000, `[Bug ${ref}] Assigned to you — ${title}`);

  // 4. Someone else (not the owner, not a triager) can comment but not change the status.
  const other = await as(browser, "prayer");
  await other.page.goto(`/admin/bugs/${number}`);
  await expect(other.page.getByText("Only the bug’s owner or a super admin can change its status.")).toBeVisible();
  await expect(other.page.getByRole("region", { name: "Triage" })).toHaveCount(0);
  await other.context.close();

  // 5. The owner finds it under "Mine", replies to the reporter, then marks it fixed.
  const owner = await as(browser, "editor");
  await owner.page.goto("/admin/bugs?tab=mine");
  await owner.page.getByRole("link", { name: new RegExp(title) }).click();
  await owner.page.getByLabel("Comment").fill("E2E: thanks — we can see it on small screens.");
  await owner.page.getByLabel("Email this to the reporter (they will see it)").check();
  await owner.page.getByRole("button", { name: "Add comment" }).click();
  await expect(owner.page.getByRole("status").filter({ hasText: "Reply emailed" })).toBeVisible();
  const status = owner.page.getByRole("region", { name: "Status" });
  await status.getByLabel("Status").selectOption("FIXED");
  await status.getByRole("button", { name: "Update status" }).click();
  await expect(status.getByRole("status")).toContainText("The reporter was emailed");
  await owner.context.close();
  const update = await waitForEmail(reporter, new Date(Date.now() - 8000), 10_000, `Update on your report ${ref}`);
  expect(update.replyTo.length).toBe(1);
  await waitForEmail("it_support@brmcc.org", since, 10_000, `[Copy · ${ref}] Update on your report ${ref}`);

  // 6. The timeline keeps the whole history.
  await admin.reload();
  const timeline = admin.getByRole("region", { name: "Timeline" });
  for (const text of ["Assigned to Content Editor (test)", "E2E: thanks", "Fixed — check it"]) await expect(timeline).toContainText(text);
});

test("files must be screenshots or PDFs; a second report can be closed as a duplicate", async ({ browser, page: admin }) => {
  await resetRateLimits();
  const visitor = await browser.newContext(anon);
  const v = await visitor.newPage();
  await v.goto("/report-a-problem");
  await v.waitForTimeout(2600);
  await v.getByLabel("What went wrong?").fill(`E2E bad file ${uid()}`);
  await v.getByLabel("Type of problem").selectOption("other");
  await v.getByLabel("What happened?").fill("E2E: testing the file check.");
  await v.getByRole("radio", { name: "It's minor or just looks wrong" }).check();
  await v.getByLabel("Screenshots or files").setInputFiles("e2e/fixtures/not-an-image.jpg");
  await v.getByRole("button", { name: "Send report" }).click();
  await expect(v.getByRole("alert").filter({ hasText: "Files must be" })).toContainText("Files must be JPG, PNG, WebP or PDF");
  await visitor.close();

  const [a, b] = await sql<{ number: number }>(
    `INSERT INTO "BugReport" (id, title, description, category, impact, "updatedAt") VALUES ('e2e-dup-a-' || $1, 'E2E original', 'x', 'broken', 'minor', now()), ('e2e-dup-b-' || $1, 'E2E copy', 'x', 'broken', 'minor', now()) RETURNING number`,
    [uid()],
  );
  await admin.goto(`/admin/bugs/${b.number}`);
  const dup = admin.getByRole("region", { name: "Duplicate" });
  await dup.getByLabel("Same problem as").fill(`BUG-${String(a.number).padStart(4, "0")}`);
  await dup.getByRole("button", { name: "Mark as duplicate" }).click();
  // The bug is now closed, so the page shows the link to the original (the form goes away).
  await expect(admin.getByText(/^Duplicate of BUG-/)).toBeVisible();
  await expect(admin.getByText("Duplicate", { exact: true }).first()).toBeVisible();
});
